from __future__ import annotations

import asyncio
import re
from collections import deque
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .html_generic import GenericHtmlConnector


class MaximumConnector(GenericHtmlConnector):
    """MAXIMUM-specific catalog discovery with generic product parsing.

    Product pages use stable numeric URLs (/ru/<id>/). Category pages use named
    slugs, so we can crawl catalog/category navigation without confusing it with
    product identity.
    """

    product_path = re.compile(r"^/(?:ru|ro)/(\d+)/?$")
    excluded_prefixes = (
        "/ru/article/", "/ro/article/", "/ru/page/", "/ro/page/",
        "/ru/articles/", "/ro/articles/", "/ru/brand/", "/ro/brand/",
    )

    async def discover_product_urls(self) -> AsyncIterator[str]:
        base = self.context.base_url.rstrip("/") + "/"
        seeds = [urljoin(base, "ru/"), urljoin(base, "ru/catalog")]
        queue: deque[str] = deque(seeds)
        visited_pages: set[str] = set()
        yielded_products: set[str] = set()
        max_navigation_pages = 350
        delay = 1.0 / max(self.context.requests_per_second, 0.1)

        async with self.client() as client:
            while queue and len(visited_pages) < max_navigation_pages:
                page_url = queue.popleft()
                if page_url in visited_pages:
                    continue
                visited_pages.add(page_url)
                try:
                    response = await client.get(page_url)
                except Exception:
                    continue
                if not response.is_success:
                    continue

                soup = BeautifulSoup(response.text, "lxml")
                for anchor in soup.select("a[href]"):
                    href = anchor.get("href")
                    if not href:
                        continue
                    absolute = urljoin(str(response.url), href)
                    parsed = urlparse(absolute)
                    if parsed.netloc.lower() != urlparse(base).netloc.lower():
                        continue
                    clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                    path = parsed.path

                    if self.product_path.match(path):
                        if clean not in yielded_products:
                            yielded_products.add(clean)
                            yield clean
                        continue

                    if not path.startswith(("/ru/", "/ro/")):
                        continue
                    if path.startswith(self.excluded_prefixes):
                        continue
                    if any(token in path for token in ("/cart", "/checkout", "/compare", "/favorites", "/login", "/search")):
                        continue
                    if clean not in visited_pages and clean not in queue:
                        queue.append(clean)

                await asyncio.sleep(delay)
