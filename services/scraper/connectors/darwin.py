from __future__ import annotations

import re
from collections.abc import AsyncIterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .html_generic import GenericHtmlConnector
from ..models import RawAvailability, RawProduct, StockStatus


class DarwinConnector(GenericHtmlConnector):
    """Darwin catalog discovery plus per-branch stock extraction."""

    max_pages = 5000
    cities = (
        "Chișinău", "Chisinau", "Bălți", "Balti", "Edineț", "Edinet", "Dondușeni", "Donduseni",
        "Ungheni", "Orhei", "Călărași", "Calarasi", "Hîncești", "Hincesti", "Comrat", "Ceadîr-Lunga",
        "Ceadir-Lunga", "Rezina", "Strășeni", "Straseni", "Cimișlia", "Cimislia", "Drochia", "Soroca",
        "Glodeni", "Cahul", "Nisporeni", "Căușeni", "Causeni", "Sîngerei", "Singerei", "Telenești", "Telenesti",
    )

    async def discover_product_urls(self) -> AsyncIterator[str]:
        seen: set[str] = set()
        async with self.client() as client:
            for page_number in range(1, self.max_pages + 1):
                listing = urljoin(self.context.base_url, f"/ru/poisk?page={page_number}")
                response = await client.get(listing)
                if not response.is_success:
                    break

                soup = BeautifulSoup(response.text, "lxml")
                page_urls: list[str] = []
                for anchor in soup.select('a[href$=".html"]'):
                    href = anchor.get("href")
                    if not href:
                        continue
                    url = urljoin(str(response.url), str(href))
                    if url in seen:
                        continue
                    seen.add(url)
                    page_urls.append(url)

                if not page_urls:
                    break
                for url in page_urls:
                    yield url

    def enrich_product(self, product: RawProduct, soup: BeautifulSoup, page_text: str) -> RawProduct:
        city_pattern = "|".join(re.escape(city) for city in sorted(self.cities, key=len, reverse=True))
        pattern = re.compile(
            rf"(?P<city>{city_pattern})\s*-\s*(?P<address>.{{2,140}}?)\s+(?P<status>În stoc|In stoc|Stoc epuizat)",
            flags=re.IGNORECASE,
        )

        availabilities: list[RawAvailability] = []
        seen: set[str] = set()
        for match in pattern.finditer(page_text):
            city = self._normalize_city(match.group("city").strip())
            address = self._clean_address(match.group("address"))
            if not address:
                continue
            key = f"{city}|{address}".lower()
            if key in seen:
                continue
            seen.add(key)
            status_text = match.group("status").lower()
            status = StockStatus.OUT_OF_STOCK if "epuizat" in status_text else StockStatus.IN_STOCK
            external_id = re.sub(r"[^a-z0-9]+", "-", key, flags=re.IGNORECASE).strip("-")[:160]
            availabilities.append(RawAvailability(
                location_external_id=external_id,
                location_name=f"Darwin {city} — {address}",
                city=city,
                address=address,
                stock_status=status,
            ))

        if availabilities:
            product.availabilities = availabilities
            statuses = {item.stock_status for item in availabilities}
            if StockStatus.IN_STOCK in statuses or StockStatus.LOW_STOCK in statuses:
                product.stock_status = StockStatus.IN_STOCK
            elif statuses == {StockStatus.OUT_OF_STOCK}:
                product.stock_status = StockStatus.OUT_OF_STOCK
            product.attributes["branch_availability_source"] = "darwin-html"
            product.attributes["branch_count"] = len(availabilities)
        return product

    @staticmethod
    def _clean_address(value: str) -> str:
        value = re.sub(r"\s+(?:Sună|Suna|Harta)\b.*$", "", value, flags=re.IGNORECASE)
        value = re.sub(r"\s+", " ", value).strip(" ,;-")
        return value[:200]

    @staticmethod
    def _normalize_city(value: str) -> str:
        aliases = {
            "chisinau": "Chișinău", "balti": "Bălți", "edinet": "Edineț", "donduseni": "Dondușeni",
            "calarasi": "Călărași", "hincesti": "Hîncești", "ceadir-lunga": "Ceadîr-Lunga", "straseni": "Strășeni",
            "cimislia": "Cimișlia", "causeni": "Căușeni", "singerei": "Sîngerei", "telenesti": "Telenești",
        }
        return aliases.get(value.lower(), value)
