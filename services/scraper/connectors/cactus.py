from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .html_generic import GenericHtmlConnector


class CactusConnector(GenericHtmlConnector):
    """Cactus-specific recursive catalogue discovery with generic product parsing."""

    async def discover_product_urls(self) -> AsyncIterator[str]:
        base = self.context.base_url.rstrip("/") + "/"
        start = urljoin(base, "ru/catalogue/")
        base_host = urlparse(base).netloc.lower()
        queue: deque[str] = deque([start])
        visited: set[str] = set()
        yielded: set[str] = set()
        max_pages = 500
        delay = 1.0 / max(self.context.requests_per_second, 0.1)

        async with self.client() as client:
            while queue and len(visited) < max_pages:
                page_url = queue.popleft()
                if page_url in visited:
                    continue
                visited.add(page_url)
                try:
                    response = await client.get(page_url)
                except Exception:
                    continue
                if not response.is_success:
                    continue

                soup = BeautifulSoup(response.text, "lxml")
                title = soup.select_one("h1, [itemprop='name'], .product-title")
                price = soup.select_one("[itemprop='price'], [data-price], .price-current, .product-price, .current-price")
                meta_price = soup.find("meta", attrs={"property": "product:price:amount"}) or soup.find("meta", attrs={"itemprop": "price"})
                if title and (price or meta_price):
                    canonical = str(response.url).split("?", 1)[0]
                    if canonical not in yielded:
                        yielded.add(canonical)
                        yield canonical
                    await asyncio.sleep(delay)
                    continue

                for anchor in soup.select("a[href]"):
                    href = anchor.get("href")
                    if not href:
                        continue
                    absolute = urljoin(str(response.url), href)
                    parsed = urlparse(absolute)
                    if parsed.netloc.lower() != base_host:
                        continue
                    if "/ru/catalogue/" not in parsed.path:
                        continue
                    clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
                    if clean not in visited and clean not in queue:
                        queue.append(clean)

                await asyncio.sleep(delay)
