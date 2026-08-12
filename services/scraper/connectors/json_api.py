from __future__ import annotations

from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urljoin

from .base import StoreConnector
from ..models import RawProduct, StockStatus


class GenericJsonApiConnector(StoreConnector):
    """Best-effort connector for public JSON/API endpoints discovered on merchant pages.

    Store-specific API connectors should override this when an endpoint requires custom
    pagination or field mapping. This generic version intentionally only consumes
    publicly reachable JSON and never bypasses authentication or access controls.
    """

    max_pages_per_endpoint = 25

    def __init__(self, context, endpoints: list[str] | None = None) -> None:
        super().__init__(context)
        self.endpoints = endpoints or []
        self._items: dict[str, dict[str, Any]] = {}

    async def discover_product_urls(self) -> AsyncIterator[str]:
        async with self.client() as client:
            visited_pages: set[str] = set()
            for endpoint in self.endpoints:
                queue = [endpoint]
                pages = 0
                while queue and pages < self.max_pages_per_endpoint:
                    page_url = queue.pop(0)
                    if page_url in visited_pages:
                        continue
                    visited_pages.add(page_url)
                    pages += 1
                    try:
                        response = await client.get(page_url)
                    except Exception:
                        continue
                    if not response.is_success:
                        continue
                    ctype = response.headers.get("content-type", "").lower()
                    if "json" not in ctype and not response.text.lstrip().startswith(("{", "[")):
                        continue
                    try:
                        payload = response.json()
                    except Exception:
                        continue

                    for item in self._walk(payload):
                        if not self._looks_like_product(item):
                            continue
                        key = self._item_url(item, page_url)
                        if key in self._items:
                            continue
                        self._items[key] = item
                        yield key

                    next_url = self._next_page(payload, str(response.url))
                    if next_url and next_url not in visited_pages:
                        queue.append(next_url)

    async def fetch_product(self, url: str) -> RawProduct | None:
        item = self._items.get(url)
        if not item:
            return None
        title = self._pick(item, "name", "title", "productName", "product_name")
        price_value = self._pick(item, "price", "salePrice", "sale_price", "currentPrice", "current_price")
        price = self._decimal(price_value)
        if not title or price is None:
            return None

        old_price = self._decimal(self._pick(item, "oldPrice", "old_price", "regularPrice", "regular_price", "compareAtPrice"))
        brand = self._pick(item, "brand", "manufacturer", "vendor")
        if isinstance(brand, dict):
            brand = self._pick(brand, "name", "title")

        image = self._pick(item, "image", "imageUrl", "image_url", "thumbnail", "picture")
        if isinstance(image, dict):
            image = self._pick(image, "url", "src")
        if isinstance(image, list):
            image = image[0] if image else None
            if isinstance(image, dict):
                image = self._pick(image, "url", "src")

        stock_status = self._stock(item)
        quantity = self._int(self._pick(item, "quantity", "qty", "stock", "stockQuantity", "stock_quantity"))
        external_id = self._pick(item, "id", "sku", "code", "ean", "gtin")
        category = self._pick(item, "category", "categoryName", "category_name")
        if isinstance(category, dict):
            category = self._pick(category, "name", "title")

        return RawProduct(
            store_slug=self.context.store_slug,
            external_id=str(external_id) if external_id is not None else url[-160:],
            title=str(title).strip(),
            description=str(self._pick(item, "description", "shortDescription", "short_description") or "").strip() or None,
            brand=str(brand).strip() if brand else None,
            sku=str(self._pick(item, "sku", "code")) if self._pick(item, "sku", "code") is not None else None,
            ean=str(self._pick(item, "ean", "gtin", "barcode")) if self._pick(item, "ean", "gtin", "barcode") is not None else None,
            category_path=[str(category)] if category else [],
            price=price,
            old_price=old_price,
            currency=str(self._pick(item, "currency", "priceCurrency", "currencyCode") or "MDL").upper(),
            stock_status=stock_status,
            quantity=quantity,
            url=self._item_url(item, self.context.base_url),
            image_url=urljoin(self.context.base_url, str(image)) if image else None,
            attributes={"source": "generic-json-api"},
        )

    def _item_url(self, item: dict[str, Any], fallback: str) -> str:
        value = self._pick(item, "url", "link", "productUrl", "product_url", "slug")
        if value:
            return urljoin(self.context.base_url, str(value))
        identifier = self._pick(item, "id", "sku", "code", "ean")
        return f"{fallback}#product-{identifier}" if identifier is not None else fallback

    @classmethod
    def _next_page(cls, payload: Any, current_url: str) -> str | None:
        if not isinstance(payload, dict):
            return None

        direct = cls._pick(payload, "next", "nextUrl", "next_url", "nextPage", "next_page")
        if isinstance(direct, str) and direct.strip():
            return urljoin(current_url, direct.strip())

        for container_name in ("links", "pagination", "paging", "meta"):
            container = payload.get(container_name)
            if not isinstance(container, dict):
                continue
            value = cls._pick(container, "next", "nextUrl", "next_url", "nextPage", "next_page")
            if isinstance(value, dict):
                value = cls._pick(value, "url", "href")
            if isinstance(value, str) and value.strip():
                return urljoin(current_url, value.strip())
        return None

    @classmethod
    def _walk(cls, value: Any):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from cls._walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from cls._walk(child)

    @staticmethod
    def _pick(item: dict[str, Any], *names: str):
        for name in names:
            if name in item and item[name] not in (None, ""):
                return item[name]
        return None

    @classmethod
    def _looks_like_product(cls, item: dict[str, Any]) -> bool:
        has_title = cls._pick(item, "name", "title", "productName", "product_name") is not None
        has_price = cls._pick(item, "price", "salePrice", "sale_price", "currentPrice", "current_price") is not None
        return has_title and has_price

    @staticmethod
    def _decimal(value) -> Decimal | None:
        if value is None or isinstance(value, (dict, list)):
            return None
        try:
            return Decimal(str(value).replace(" ", "").replace(",", "."))
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _int(value) -> int | None:
        try:
            return int(value) if value is not None and not isinstance(value, (dict, list)) else None
        except (TypeError, ValueError):
            return None

    @classmethod
    def _stock(cls, item: dict[str, Any]) -> StockStatus:
        value = cls._pick(item, "availability", "stockStatus", "stock_status", "available", "inStock", "in_stock")
        if isinstance(value, bool):
            return StockStatus.IN_STOCK if value else StockStatus.OUT_OF_STOCK
        text = str(value or "").lower()
        if any(x in text for x in ("outofstock", "out_of_stock", "soldout", "unavailable", "false")):
            return StockStatus.OUT_OF_STOCK
        if any(x in text for x in ("instock", "in_stock", "available", "true")):
            return StockStatus.IN_STOCK
        if "preorder" in text:
            return StockStatus.PREORDER
        return StockStatus.UNKNOWN
