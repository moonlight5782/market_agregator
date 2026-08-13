from __future__ import annotations

import re
from collections import deque
from collections.abc import AsyncIterator
from urllib.parse import urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup, Tag

from .base import ConnectorContext
from .html_generic import GenericHtmlConnector


class GenericCatalogConnector(GenericHtmlConnector):
    """Same-origin catalog discovery for previously unknown stores.

    The connector starts from the merchant root plus catalog entrypoints found by
    source discovery. It traverses likely catalog/category pages, detects
    product-card links from semantic markup, CSS class hints, URL shapes and
    nearby price text, then reuses GenericHtmlConnector for product parsing.
    """

    # A hard limit still protects against pathological filter/query explosions,
    # but 300 was too small for real supermarket catalogs with hundreds of
    # pagination pages plus taxonomy pages. Reaching this cap is exposed so the
    # run report cannot claim the strategy was fully exhausted.
    max_listing_pages = 5000

    _catalog_tokens = (
        "/catalog", "/catalogue", "/katalog", "/category", "/categories", "/shop", "/store",
        "/products", "/produse", "/search", "/collections", "/colectii",
    )
    _product_tokens = (
        "/product/", "/products/", "/produs/", "/item/", "/p/", "/goods/", "/detail/",
    )
    _skip_tokens = (
        "/cart", "/basket", "/checkout", "/login", "/register", "/account", "/wishlist",
        "/compare", "/contact", "/about", "/blog", "/news", "/novosti", "/component/content/",
        "mailto:", "tel:", "javascript:",
    )
    _price_re = re.compile(r"(?:\d[\d\s.,]{0,12})\s*(?:MDL|LEI|RON|EUR|€|USD|\$)\b", re.I)

    def __init__(self, context: ConnectorContext, seed_urls: list[str] | None = None) -> None:
        super().__init__(context)
        self.seed_urls = list(seed_urls or [])
        self.listing_page_cap_reached = False
        self.listing_pages_visited = 0

    def _initial_listing_urls(self) -> list[str]:
        base = self._clean_url(self.context.base_url)
        host = urlparse(base).netloc.lower()
        urls: list[str] = []
        # Source-discovered category pages are usually far more selective than
        # a merchant homepage. Process them first so a large news-heavy homepage
        # cannot delay product collection; retain the homepage as a fallback.
        for candidate in [*self.seed_urls, base]:
            cleaned = self._clean_url(urljoin(base, candidate))
            if urlparse(cleaned).netloc.lower() != host:
                continue
            if self._is_product_detail_path(urlparse(cleaned).path.lower()):
                continue
            if cleaned not in urls:
                urls.append(cleaned)
        return urls

    async def discover_product_urls(self) -> AsyncIterator[str]:
        base = self._clean_url(self.context.base_url)
        host = urlparse(base).netloc.lower()
        queue: deque[str] = deque(self._initial_listing_urls())
        visited: set[str] = set()
        yielded: set[str] = set()
        self.listing_page_cap_reached = False
        self.listing_pages_visited = 0

        async with self.client() as client:
            while queue:
                if len(visited) >= self.max_listing_pages:
                    self.listing_page_cap_reached = True
                    break

                page_url = queue.popleft()
                if page_url in visited:
                    continue
                visited.add(page_url)
                self.listing_pages_visited = len(visited)

                try:
                    response = await client.get(page_url)
                except Exception:
                    continue
                if not response.is_success:
                    continue

                soup = BeautifulSoup(response.text, "lxml")
                for anchor in soup.select("a[href]"):
                    href = str(anchor.get("href") or "").strip()
                    if not href or self._skip_href(href):
                        continue
                    absolute = self._clean_url(urljoin(str(response.url), href))
                    parsed = urlparse(absolute)
                    if parsed.netloc.lower() != host:
                        continue

                    if self._looks_like_product_anchor(anchor, absolute):
                        if absolute not in yielded:
                            yielded.add(absolute)
                            yield absolute
                        continue

                    if self._looks_like_listing_link(anchor, absolute) and absolute not in visited and absolute not in queue:
                        queue.append(absolute)

    @classmethod
    def _is_product_detail_path(cls, path: str) -> bool:
        if any(token in path for token in cls._product_tokens):
            return True
        if "/katalog/" in path:
            segments = [segment for segment in path.split("/") if segment]
            return path.endswith("-detail") or (len(segments) >= 4 and "detail" in segments[-1])
        return False

    @classmethod
    def _looks_like_product_anchor(cls, anchor: Tag, url: str) -> bool:
        path = urlparse(url).path.lower()
        if cls._is_product_detail_path(path):
            return True

        node: Tag | None = anchor
        for _ in range(4):
            if not isinstance(node, Tag):
                break
            classes = " ".join(node.get("class", [])).lower()
            itemtype = str(node.get("itemtype") or "").lower()
            if (
                "product" in classes
                or "produs" in classes
                or node.has_attr("data-product-id")
                or "schema.org/product" in itemtype
            ):
                return True
            text = node.get_text(" ", strip=True)
            if cls._price_re.search(text):
                return True
            node = node.parent if isinstance(node.parent, Tag) else None
        return False

    @classmethod
    def _looks_like_listing_link(cls, anchor: Tag, url: str) -> bool:
        path = urlparse(url).path.lower()
        if any(token in path for token in cls._catalog_tokens):
            return True
        text = anchor.get_text(" ", strip=True).lower()
        return any(word in text for word in (
            "catalog", "catalogue", "каталог", "produse", "products", "magazin",
            "categorie", "category", "категори", "toate produsele", "все товары",
        ))

    @classmethod
    def _skip_href(cls, href: str) -> bool:
        lowered = href.lower()
        return lowered.startswith(("#", "mailto:", "tel:", "javascript:")) or "novosti" in lowered or any(
            token in lowered for token in cls._skip_tokens
        )

    @staticmethod
    def _clean_url(url: str) -> str:
        parsed = urlparse(url)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path or "/", "", parsed.query, ""))
