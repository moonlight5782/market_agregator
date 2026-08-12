from __future__ import annotations

from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation
from urllib.parse import urljoin
import re

from bs4 import BeautifulSoup

from .base import StoreConnector
from ..models import RawProduct, StockStatus


class GenericHtmlConnector(StoreConnector):
    """Fallback connector for stores without usable Product JSON-LD."""

    product_link_selectors = (
        'a[href*="/product/"]',
        'a[href*="/products/"]',
        'a[href*="/produs/"]',
        'a[href*="/catalog/"]',
        '.product-card a[href]',
        '.product-item a[href]',
    )

    async def discover_product_urls(self) -> AsyncIterator[str]:
        seen: set[str] = set()
        async with self.client() as client:
            response = await client.get(self.context.base_url)
            if not response.is_success:
                return
            soup = BeautifulSoup(response.text, "lxml")
            for selector in self.product_link_selectors:
                for anchor in soup.select(selector):
                    href = anchor.get("href")
                    if not href:
                        continue
                    url = urljoin(str(response.url), href)
                    if url not in seen:
                        seen.add(url)
                        yield url

    async def fetch_product(self, url: str) -> RawProduct | None:
        async with self.client() as client:
            response = await client.get(url)
            if not response.is_success:
                return None
        soup = BeautifulSoup(response.text, "lxml")
        page_text = soup.get_text(" ", strip=True)

        title = self._first_text(soup, ["h1", '[itemprop="name"]', '.product-title', '.product__title'])
        if not title:
            return None

        price_text = self._first_text(soup, [
            '[itemprop="price"]', '[data-price]', '.price-current', '.product-price', '.price', '.current-price'
        ])
        price = self._decimal(price_text)
        if price is None:
            meta_price = soup.find("meta", attrs={"property": "product:price:amount"}) or soup.find("meta", attrs={"itemprop": "price"})
            price = self._decimal(meta_price.get("content") if meta_price else None)
        if price is None:
            return None

        old_price = self._decimal(self._first_text(soup, ['.old-price', '.price-old', '.regular-price', 'del']))
        image = None
        image_node = soup.select_one('[itemprop="image"], .product-image img, .gallery img, main img')
        if image_node:
            image = image_node.get("src") or image_node.get("data-src")
            image = urljoin(str(response.url), image) if image else None

        quantity = self._quantity_from_text(page_text)
        availability_text = " ".join(filter(None, [
            self._first_text(soup, ['[itemprop="availability"]', '.stock', '.availability', '.product-stock']),
            str(soup.find("meta", attrs={"property": "product:availability"}) or ""),
            page_text,
        ])).lower()
        status = self._stock_status(availability_text, quantity)

        sku_node = soup.find(attrs={"itemprop": "sku"})
        sku = sku_node.get("content") if sku_node and sku_node.has_attr("content") else (sku_node.get_text(" ", strip=True) if sku_node else None)
        if not sku:
            sku = self._sku_from_text(page_text)

        brand = self._first_text(soup, ['[itemprop="brand"]', '.brand', '.product-brand'])
        category_path = [x.get_text(" ", strip=True) for x in soup.select('.breadcrumb a, nav[aria-label*="breadcrumb" i] a')][1:]
        description = self._first_text(soup, ['[itemprop="description"]', '.product-description', '#description'])

        raw = RawProduct(
            store_slug=self.context.store_slug,
            external_id=str(sku or self._url_key(url)),
            title=title,
            description=description,
            brand=brand,
            sku=str(sku).strip() if sku else None,
            category_path=category_path,
            price=price,
            old_price=old_price,
            currency=self._currency(soup),
            stock_status=status,
            quantity=quantity,
            url=url,
            image_url=image,
            attributes={"source": "html-generic"},
        )
        return self.enrich_product(raw, soup, page_text)

    def enrich_product(self, product: RawProduct, soup: BeautifulSoup, page_text: str) -> RawProduct:
        """Store-specific subclasses may enrich the already parsed product without another HTTP request."""
        return product

    @staticmethod
    def _stock_status(availability_text: str, quantity: int | None) -> StockStatus:
        if quantity is not None:
            if quantity <= 0:
                return StockStatus.OUT_OF_STOCK
            if quantity <= 10:
                return StockStatus.LOW_STOCK
            return StockStatus.IN_STOCK
        text = availability_text.lower()
        if any(x in text for x in ("out of stock", "indisponibil", "stoc epuizat", "nu este în stoc", "nu este in stoc", "нет в наличии")):
            return StockStatus.OUT_OF_STOCK
        if any(x in text for x in ("low stock", "stoc limitat", "ultimele", "мало")):
            return StockStatus.LOW_STOCK
        if any(x in text for x in ("in stock", "in stoc", "disponibil", "disponibilitate", "в наличии", "наличие")):
            return StockStatus.IN_STOCK
        return StockStatus.UNKNOWN

    @staticmethod
    def _quantity_from_text(text: str) -> int | None:
        patterns = (
            r"(?:Disponibilitate|Наличие|Availability)\s*:?\s*(\d{1,7})\b",
            r"(?:În stoc|In stoc)\s*:?\s*(\d{1,7})\b",
        )
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return int(match.group(1))
        return None

    @staticmethod
    def _sku_from_text(text: str) -> str | None:
        patterns = (
            r"(?:Articol|Артикул|SKU|Cod produs|Cod produsului)\s*:?\s*([A-Za-z0-9._/-]{2,64})",
        )
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    @staticmethod
    def _first_text(soup: BeautifulSoup, selectors: list[str]) -> str | None:
        for selector in selectors:
            node = soup.select_one(selector)
            if node:
                value = node.get("content") if node.has_attr("content") else node.get_text(" ", strip=True)
                if value and str(value).strip():
                    return str(value).strip()
        return None

    @staticmethod
    def _decimal(value) -> Decimal | None:
        if value is None:
            return None
        cleaned = re.sub(r"[^0-9,.-]", "", str(value)).replace(" ", "")
        if cleaned.count(",") == 1 and cleaned.count(".") == 0:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _currency(soup: BeautifulSoup) -> str:
        node = soup.find("meta", attrs={"property": "product:price:currency"}) or soup.find(attrs={"itemprop": "priceCurrency"})
        if node:
            value = node.get("content") or node.get_text(" ", strip=True)
            if value:
                return str(value).upper()
        text = soup.get_text(" ", strip=True)
        if "€" in text or "EUR" in text:
            return "EUR"
        return "MDL"

    @staticmethod
    def _url_key(url: str) -> str:
        return re.sub(r"[^a-zA-Z0-9]+", "-", url).strip("-")[-160:]
