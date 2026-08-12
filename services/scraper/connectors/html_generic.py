from __future__ import annotations

from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation
from urllib.parse import urljoin, urlparse, unquote
import re

from bs4 import BeautifulSoup, Tag

from .base import StoreConnector
from ..models import RawProduct, StockStatus


class GenericHtmlConnector(StoreConnector):
    """Fallback parser for product pages without a usable structured source."""

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
        image = self._extract_product_image(soup, str(response.url))

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
        if not category_path:
            category_path = self._category_path_from_url(str(response.url))
        description = self._first_text(soup, ['[itemprop="description"]', '.product-description', '#description', '.description'])

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
        if any(x in text for x in (
            "out of stock", "indisponibil", "stoc epuizat", "nu este în stoc", "nu este in stoc",
            "nu este disponibil", "нет в наличии", "не в наличии",
        )):
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
        labels = (
            r"Codul\s+produsului",
            r"Codul\s+produs",
            r"Cod\s+produsului",
            r"Cod\s+produs",
            r"Код\s+товара",
            r"Articol",
            r"Артикул",
            r"SKU",
        )
        pattern = rf"(?:{'|'.join(labels)})\s*:?\s*([A-Za-z0-9._/-]{{2,64}})\b"
        match = re.search(pattern, text, flags=re.IGNORECASE)
        return match.group(1).strip() if match else None

    @classmethod
    def _extract_product_image(cls, soup: BeautifulSoup, page_url: str) -> str | None:
        selectors = (
            '[itemprop="image"]', '.product-image img', '.product__image img', '.product-gallery img',
            '.gallery img', '[class*="product"][class*="image"] img', 'main img',
        )
        attributes = ("data-src", "data-original", "data-lazy-src", "data-zoom-image", "src")
        for selector in selectors:
            for node in soup.select(selector):
                if not isinstance(node, Tag):
                    continue
                for attr in attributes:
                    candidate = node.get(attr)
                    if candidate and cls._usable_image_url(str(candidate)):
                        return urljoin(page_url, str(candidate))
                srcset = node.get("data-srcset") or node.get("srcset")
                if srcset:
                    candidates = [part.strip().split(" ", 1)[0] for part in str(srcset).split(",") if part.strip()]
                    for candidate in reversed(candidates):
                        if cls._usable_image_url(candidate):
                            return urljoin(page_url, candidate)

        # Social preview images are frequently global storefront placeholders.
        # Keep them only when they are not visibly marked as generic/social assets.
        image_meta = (
            soup.find("meta", attrs={"property": "og:image"})
            or soup.find("meta", attrs={"name": "twitter:image"})
            or soup.find("link", attrs={"rel": "image_src"})
        )
        if image_meta:
            candidate = image_meta.get("content") or image_meta.get("href")
            if candidate and cls._usable_image_url(str(candidate), social_fallback=True):
                return urljoin(page_url, str(candidate))
        return None

    @staticmethod
    def _usable_image_url(value: str, social_fallback: bool = False) -> bool:
        lowered = value.strip().lower()
        if not lowered or lowered.startswith("data:"):
            return False
        bad_tokens = ("placeholder", "no-image", "no_image", "default-image", "default_image", "spinner", "loading.gif", "blank.gif", "sprite")
        if any(token in lowered for token in bad_tokens):
            return False
        if social_fallback and any(token in lowered for token in ("social", "share", "og-image", "og_image", "og500x", "facebook")):
            return False
        return True

    @staticmethod
    def _category_path_from_url(url: str) -> list[str]:
        path = unquote(urlparse(url).path)
        parts = [part for part in path.split("/") if part]
        if len(parts) < 2:
            return []
        ignored = {
            "ru", "ro", "en", "catalog", "catalogue", "category", "categories", "products", "product",
            "produse", "produs", "shop", "store", "item", "detail", "p",
        }
        cleaned: list[str] = []
        # Last segment is normally the product slug. Parent segments carry taxonomy.
        for part in parts[:-1]:
            normalized = re.sub(r"[_-]+", " ", part).strip().lower()
            if not normalized or normalized in ignored or normalized.isdigit():
                continue
            cleaned.append(normalized)
        return cleaned[-3:]

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
