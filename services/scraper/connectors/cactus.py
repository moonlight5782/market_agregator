from __future__ import annotations

from collections import deque
from collections.abc import AsyncIterator
import re
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag

from .html_generic import GenericHtmlConnector


class CactusConnector(GenericHtmlConnector):
    """Cactus-specific catalogue discovery with shared product parsing.

    Cactus keeps both categories and products under /catalogue/. Listing pages
    render product links together with a MDL price. We use that public structure
    to yield product URLs directly instead of opening every deep URL just to
    determine whether it is a category or a product.
    """

    async def discover_product_urls(self) -> AsyncIterator[str]:
        base = self.context.base_url.rstrip("/") + "/"
        start = urljoin(base, "ru/catalogue/")
        base_host = urlparse(base).netloc.lower()
        queue: deque[str] = deque([start])
        visited: set[str] = set()
        yielded: set[str] = set()
        max_pages = 500

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
                for anchor in soup.select("a[href]"):
                    href = anchor.get("href")
                    if not href:
                        continue
                    absolute = urljoin(str(response.url), str(href))
                    parsed = urlparse(absolute)
                    if parsed.netloc.lower() != base_host or "/ru/catalogue/" not in parsed.path:
                        continue
                    clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"

                    if self._looks_like_product_anchor(anchor, parsed.path):
                        if clean not in yielded:
                            yielded.add(clean)
                            yield clean
                        continue

                    if clean not in visited and clean not in queue:
                        queue.append(clean)

    @staticmethod
    def _looks_like_product_anchor(anchor: Tag, path: str) -> bool:
        segments = [segment for segment in path.split("/") if segment]
        if len(segments) < 5:
            return False
        title = anchor.get_text(" ", strip=True)
        if len(title) < 4:
            return False

        node: Tag | None = anchor
        for _ in range(4):
            parent = node.parent if node else None
            if not isinstance(parent, Tag):
                break
            node = parent
            text = node.get_text(" ", strip=True)
            catalogue_links = node.select('a[href*="/catalogue/"]')
            if len(catalogue_links) <= 4 and re.search(r"\b\d[\d\s.,]*\s*(?:лей|lei)\b", text, flags=re.IGNORECASE):
                return True
        return False
