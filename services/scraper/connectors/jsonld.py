from __future__ import annotations

import json
import re
from collections.abc import AsyncIterator
from decimal import Decimal, InvalidOperation
from urllib.parse import urljoin
from xml.etree import ElementTree

from bs4 import BeautifulSoup

from .base import StoreConnector
from ..models import RawProduct, StockStatus


class SitemapJsonLdConnector(StoreConnector):
    """Reusable connector for stores exposing sitemaps and schema.org Product JSON-LD.

    This is intentionally store-agnostic. Store-specific behavior belongs in config or a
    small subclass only when the merchant deviates from common web standards.
    """

    sitemap_paths = ("/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml")

    async def discover_product_urls(self) -> AsyncIterator[str]:
        async with self.client() as client:
            candidates: list[str] = [urljoin(self.context.base_url, path) for path in self.sitemap_paths]

            robots_url = urljoin(self.context.base_url, "/robots.txt")
            try:
                robots = await client.get(robots_url)
                if robots.is_success:
                    for line in robots.text.splitlines():
                        if line.lower().startswith("sitemap:"):
                            candidate = line.split(":", 1)[1].strip()
                            if candidate:
                                candidates.append(candidate)
            except Exception:
                pass

            seen_sitemaps: set[str] = set()
            yielded_urls: set[str] = set()
            for candidate in dict.fromkeys(candidates):
                try:
                    response = await client.get(candidate)
                except Exception:
                    continue
                if not response.is_success:
                    continue
                body = response.text
                if "<urlset" not in body and "<sitemapindex" not in body:
                    continue
                async for url in self._walk_sitemap(client, str(response.url), body, seen_sitemaps):
                    if url in yielded_urls:
                        continue
                    yielded_urls.add(url)
                    yield url

    async def _walk_sitemap(self, client, sitemap_url: str, xml: str, seen: set[str]) -> AsyncIterator[str]:
        if sitemap_url in seen:
            return
        seen.add(sitemap_url)
        try:
            root = ElementTree.fromstring(xml)
        except ElementTree.ParseError:
            return

        namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        if root.tag.endswith("sitemapindex"):
            for node in root.findall(f"{namespace}sitemap/{namespace}loc"):
                child_url = (node.text or "").strip()
                if not child_url:
                    continue
                try:
                    response = await client.get(child_url)
                except Exception:
                    continue
                if response.is_success:
                    async for url in self._walk_sitemap(client, str(response.url), response.text, seen):
                        yield url
            return

        for node in root.findall(f"{namespace}url/{namespace}loc"):
            url = (node.text or "").strip()
            if url:
                yield url

    async def fetch_product(self, url: str) -> RawProduct | None:
        async with self.client() as client:
            response = await client.get(url)
            if not response.is_success:
                return None
        soup = BeautifulSoup(response.text, "lxml")
        product = self._find_product_jsonld(soup)
        if not product:
            return None

        offers = product.get("offers") or {}
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        price = self._decimal(offers.get("price") or offers.get("lowPrice"))
        if price is None:
            return None

        title = str(product.get("name") or "").strip()
        if not title:
            return None

        availability = str(offers.get("availability") or "").lower()
        stock_status = StockStatus.UNKNOWN
        if "instock" in availability:
            stock_status = StockStatus.IN_STOCK
        elif "outofstock" in availability or "soldout" in availability:
            stock_status = StockStatus.OUT_OF_STOCK
        elif "preorder" in availability:
            stock_status = StockStatus.PREORDER

        brand = product.get("brand")
        if isinstance(brand, dict):
            brand = brand.get("name")

        image = product.get("image")
        if isinstance(image, list):
            image = image[0] if image else None
        elif isinstance(image, dict):
            image = image.get("url") or image.get("contentUrl")

        sku = product.get("sku")
        gtin = product.get("gtin13") or product.get("gtin14") or product.get("gtin12") or product.get("gtin")
        mpn = product.get("mpn")

        category = product.get("category")
        category_path = [str(category)] if category else []

        external_id = str(sku or gtin or mpn or self._url_key(url))
        currency = str(offers.get("priceCurrency") or "MDL").upper()

        return RawProduct(
            store_slug=self.context.store_slug,
            external_id=external_id,
            title=title,
            description=self._clean_text(product.get("description")),
            brand=str(brand).strip() if brand else None,
            sku=str(sku) if sku else None,
            ean=str(gtin) if gtin else None,
            mpn=str(mpn) if mpn else None,
            category_path=category_path,
            price=price,
            currency=currency,
            stock_status=stock_status,
            url=url,
            image_url=image,
            attributes={"source": "json-ld"},
        )

    @staticmethod
    def _find_product_jsonld(soup: BeautifulSoup) -> dict | None:
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            raw = script.string or script.get_text()
            if not raw.strip():
                continue
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            stack = data if isinstance(data, list) else [data]
            while stack:
                node = stack.pop()
                if isinstance(node, list):
                    stack.extend(node)
                    continue
                if not isinstance(node, dict):
                    continue
                node_type = node.get("@type")
                if node_type == "Product" or (isinstance(node_type, list) and "Product" in node_type):
                    return node
                graph = node.get("@graph")
                if isinstance(graph, list):
                    stack.extend(graph)
        return None

    @staticmethod
    def _decimal(value) -> Decimal | None:
        if value is None:
            return None
        cleaned = re.sub(r"[^0-9,.-]", "", str(value)).replace(",", ".")
        try:
            return Decimal(cleaned)
        except (InvalidOperation, ValueError):
            return None

    @staticmethod
    def _clean_text(value) -> str | None:
        if not value:
            return None
        return BeautifulSoup(str(value), "lxml").get_text(" ", strip=True)

    @staticmethod
    def _url_key(url: str) -> str:
        return re.sub(r"[^a-zA-Z0-9]+", "-", url).strip("-")[-160:]
