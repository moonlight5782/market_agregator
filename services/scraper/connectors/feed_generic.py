from __future__ import annotations

import csv
import io
import json
from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urljoin
from xml.etree import ElementTree

from .base import StoreConnector
from ..models import RawProduct, StockStatus


class GenericFeedConnector(StoreConnector):
    """Best-effort reader for public JSON/XML/CSV/YML catalog feeds."""

    def __init__(self, context, feeds: list[str] | None = None) -> None:
        super().__init__(context)
        self.feeds = feeds or []
        self._items: dict[str, dict[str, Any]] = {}

    async def discover_product_urls(self) -> AsyncIterator[str]:
        async with self.client() as client:
            for feed_url in self.feeds:
                try:
                    response = await client.get(feed_url)
                except Exception:
                    continue
                if not response.is_success:
                    continue
                for item in self._parse(response.text, response.headers.get("content-type", "")):
                    if not self._looks_like_product(item):
                        continue
                    key = self._url(item, feed_url)
                    if key not in self._items:
                        self._items[key] = item
                        yield key

    async def fetch_product(self, url: str) -> RawProduct | None:
        item = self._items.get(url)
        if not item:
            return None
        title = self._pick(item, "name", "title", "product", "product_name")
        price = self._decimal(self._pick(item, "price", "sale_price", "salePrice", "current_price"))
        if not title or price is None:
            return None
        old_price = self._decimal(self._pick(item, "old_price", "oldPrice", "regular_price", "compare_at_price"))
        available = str(self._pick(item, "available", "availability", "in_stock", "stock_status") or "").lower()
        if available in ("1", "true", "yes", "available", "in_stock", "instock"):
            stock = StockStatus.IN_STOCK
        elif available in ("0", "false", "no", "unavailable", "out_of_stock", "outofstock"):
            stock = StockStatus.OUT_OF_STOCK
        else:
            stock = StockStatus.UNKNOWN

        image = self._pick(item, "image", "image_url", "picture", "picture_url")
        category = self._pick(item, "category", "category_name", "categoryName")
        return RawProduct(
            store_slug=self.context.store_slug,
            external_id=str(self._pick(item, "id", "sku", "code", "ean") or url[-160:]),
            title=str(title).strip(),
            brand=str(self._pick(item, "brand", "vendor", "manufacturer") or "").strip() or None,
            sku=str(self._pick(item, "sku", "code")) if self._pick(item, "sku", "code") is not None else None,
            ean=str(self._pick(item, "ean", "gtin", "barcode")) if self._pick(item, "ean", "gtin", "barcode") is not None else None,
            category_path=[str(category)] if category else [],
            price=price,
            old_price=old_price,
            currency=str(self._pick(item, "currency", "price_currency") or "MDL").upper(),
            stock_status=stock,
            quantity=self._int(self._pick(item, "quantity", "qty", "stock_quantity")),
            url=self._url(item, self.context.base_url),
            image_url=urljoin(self.context.base_url, str(image)) if image else None,
            attributes={"source": "generic-feed"},
        )

    def _parse(self, text: str, content_type: str) -> list[dict[str, Any]]:
        stripped = text.lstrip()
        if "json" in content_type.lower() or stripped.startswith(("{", "[")):
            try:
                payload = json.loads(text)
                return list(self._walk_json(payload))
            except Exception:
                return []
        if stripped.startswith("<"):
            return self._parse_xml(text)
        try:
            return [dict(row) for row in csv.DictReader(io.StringIO(text))]
        except Exception:
            return []

    def _parse_xml(self, text: str) -> list[dict[str, Any]]:
        try:
            root = ElementTree.fromstring(text)
        except ElementTree.ParseError:
            return []
        items: list[dict[str, Any]] = []
        for node in root.iter():
            tag = node.tag.split("}")[-1].lower()
            if tag not in ("offer", "product", "item", "entry"):
                continue
            item: dict[str, Any] = dict(node.attrib)
            for child in list(node):
                key = child.tag.split("}")[-1]
                if child.text and child.text.strip():
                    item[key] = child.text.strip()
            items.append(item)
        return items

    @classmethod
    def _walk_json(cls, value: Any):
        if isinstance(value, dict):
            yield value
            for child in value.values():
                yield from cls._walk_json(child)
        elif isinstance(value, list):
            for child in value:
                yield from cls._walk_json(child)

    @staticmethod
    def _pick(item: dict[str, Any], *names: str):
        lower = {str(k).lower(): v for k, v in item.items()}
        for name in names:
            if name in item and item[name] not in (None, ""):
                return item[name]
            value = lower.get(name.lower())
            if value not in (None, ""):
                return value
        return None

    @classmethod
    def _looks_like_product(cls, item: dict[str, Any]) -> bool:
        return cls._pick(item, "name", "title", "product", "product_name") is not None and cls._pick(item, "price", "sale_price", "salePrice", "current_price") is not None

    def _url(self, item: dict[str, Any], fallback: str) -> str:
        value = self._pick(item, "url", "link", "product_url", "productUrl")
        return urljoin(self.context.base_url, str(value)) if value else fallback

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
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None
