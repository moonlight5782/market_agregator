from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urljoin
import re

import httpx
from bs4 import BeautifulSoup


@dataclass
class SourceProfile:
    base_url: str
    sitemap_urls: list[str] = field(default_factory=list)
    product_jsonld: bool = False
    embedded_json: bool = False
    html_product_hints: bool = False
    api_hints: list[str] = field(default_factory=list)
    blocked: bool = False


API_PATTERNS = (
    r"/api/[^\"']+",
    r"/graphql(?:\?[^\"']*)?",
    r"/_next/data/[^\"']+\.json",
)


async def discover_sources(base_url: str, timeout_seconds: float = 20.0) -> SourceProfile:
    profile = SourceProfile(base_url=base_url)
    headers = {"User-Agent": "MoldovaCommerceBot/0.2 (+catalog-indexer)"}
    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True, headers=headers) as client:
        try:
            response = await client.get(base_url)
        except httpx.HTTPError:
            profile.blocked = True
            return profile

        if response.status_code in (401, 403, 429):
            profile.blocked = True
        html = response.text if response.is_success else ""
        soup = BeautifulSoup(html, "lxml")

        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            text = script.string or script.get_text() or ""
            if '"Product"' in text or "'Product'" in text:
                profile.product_jsonld = True
                break

        profile.embedded_json = bool(
            soup.find("script", id="__NEXT_DATA__")
            or soup.find("script", attrs={"type": "application/json"})
            or re.search(r"window\.__[A-Z0-9_]+__\s*=", html)
        )
        profile.html_product_hints = bool(
            soup.select_one('[itemtype*="schema.org/Product"], [data-product-id], .product-card, .product-item, .product')
        )

        found_api: set[str] = set()
        for pattern in API_PATTERNS:
            for match in re.findall(pattern, html, flags=re.I):
                found_api.add(urljoin(str(response.url), match))
        profile.api_hints = sorted(found_api)[:20]

        candidates = [
            urljoin(base_url, "/sitemap.xml"),
            urljoin(base_url, "/sitemap_index.xml"),
            urljoin(base_url, "/sitemap-index.xml"),
        ]
        robots = urljoin(base_url, "/robots.txt")
        try:
            rr = await client.get(robots)
            if rr.is_success:
                for line in rr.text.splitlines():
                    if line.lower().startswith("sitemap:"):
                        candidates.append(line.split(":", 1)[1].strip())
        except httpx.HTTPError:
            pass

        for candidate in dict.fromkeys(candidates):
            try:
                sr = await client.get(candidate)
                if sr.is_success and ("xml" in sr.headers.get("content-type", "").lower() or "<urlset" in sr.text or "<sitemapindex" in sr.text):
                    profile.sitemap_urls.append(str(sr.url))
            except httpx.HTTPError:
                continue

    return profile
