from __future__ import annotations

from collections.abc import AsyncIterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .html_generic import GenericHtmlConnector


class DarwinConnector(GenericHtmlConnector):
    """Darwin-specific catalog discovery with generic product-page parsing.

    Darwin exposes a server-rendered paginated search/catalog page. We only specialize
    URL discovery here and keep the common HTML product extraction from the base class.
    """

    max_pages = 5000

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
