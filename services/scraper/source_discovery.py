from __future__ import annotations

from dataclasses import dataclass, field
from time import perf_counter
from urllib.parse import urljoin, urlparse
import re

import httpx
from bs4 import BeautifulSoup, Tag

from .robots import RobotsPolicy, load_robots_policy


@dataclass
class SourceProfile:
    base_url: str
    sitemap_urls: list[str] = field(default_factory=list)
    catalog_urls: list[str] = field(default_factory=list)
    discovery_pages: list[str] = field(default_factory=list)
    product_jsonld: bool = False
    embedded_json: bool = False
    html_product_hints: bool = False
    api_hints: list[str] = field(default_factory=list)
    feed_hints: list[str] = field(default_factory=list)
    availability_context_hints: list[str] = field(default_factory=list)
    blocked: bool = False
    robots_status: str = "UNAVAILABLE"
    robots_url: str | None = None
    robots_reason: str | None = None
    robots_policy: RobotsPolicy | None = None
    discovery_duration_seconds: float = 0.0
    discovery_budget_exhausted: bool = False


API_PATTERNS = (
    r"(?<![A-Za-z0-9:/])/api/[^\"'<> ]+",
    r"(?<![A-Za-z0-9:/])/graphql(?:\?[^\"'<> ]*)?",
    r"(?<![A-Za-z0-9:/])/_next/data/[^\"'<> ]+\.json",
)
FEED_EXTENSIONS = (".json", ".xml", ".csv", ".yml", ".yaml")
COMMON_FEEDS = (
    "/products.json",
    "/catalog.json",
    "/feed.xml",
    "/products.xml",
)
CATALOG_PATH_TOKENS = (
    "/catalog",
    "/catalogue",
    "/katalog",
    "/category",
    "/categories",
    "/shop",
    "/products",
    "/produse",
    "/collections",
    "/colectii",
)
CATALOG_TEXT_TOKENS = (
    "catalog",
    "catalogue",
    "каталог",
    "produse",
    "products",
    "magazin online",
    "supermarket online",
    "categorie",
    "category",
    "категори",
)
AVAILABILITY_CONTEXT_PATTERNS: tuple[tuple[str, str], ...] = (
    ("region-selector", r"\b(?:choose region|alege(?:ți|ti)? regiunea|выберите регион|регион)\b"),
    ("delivery-context", r"\b(?:delivery|livrare|достав\w*)\b"),
    ("store-selector", r"\b(?:choose store|select store|alege(?:ți|ti)? magazin|выберите магазин)\b"),
)
MAX_DISCOVERY_CATALOG_PAGES = 1
MAX_CATALOG_URLS = 20
MAX_SCRIPT_ASSETS = 2
MAX_API_HINTS = 20
MAX_API_VALIDATION = 10
MAX_FEED_HINTS = 20
PROBE_TIMEOUT_SECONDS = 4.0
CATALOG_PROBE_TIMEOUT_SECONDS = 8.0


def _same_origin(url: str, origin_url: str) -> bool:
    return urlparse(url).netloc.lower() == urlparse(origin_url).netloc.lower()


def _finish_profile(profile: SourceProfile, started: float) -> SourceProfile:
    profile.discovery_duration_seconds = round(perf_counter() - started, 3)
    print(
        f"[SOURCE-DISCOVERY] duration={profile.discovery_duration_seconds}s; "
        f"pages={len(profile.discovery_pages)}; catalogs={len(profile.catalog_urls)}; "
        f"api={len(profile.api_hints)}; feeds={len(profile.feed_hints)}; "
        f"sitemaps={len(profile.sitemap_urls)}; robots={profile.robots_status}; blocked={profile.blocked}; "
        f"budget_exhausted={profile.discovery_budget_exhausted}"
    )
    return profile


def _looks_like_catalog_link(anchor: Tag, absolute_url: str) -> bool:
    parsed = urlparse(absolute_url)
    path = parsed.path.lower().rstrip("/")
    # CMS news sections can have a generic `/category/` URL shape. They must
    # never seed product discovery simply because a title contains "catalog".
    if any(token in path for token in ("/component/content/", "/novosti", "/news")):
        return False
    text = anchor.get_text(" ", strip=True).lower()
    if any(token in text for token in CATALOG_TEXT_TOKENS):
        return True
    return any(
        path == token or path.endswith(token) or f"{token}/" in path
        for token in CATALOG_PATH_TOKENS
    )


def extract_catalog_urls(page_url: str, html: str) -> list[str]:
    """Return same-origin official catalog/category entrypoints found in HTML."""
    soup = BeautifulSoup(html, "lxml")
    found: set[str] = set()
    for anchor in soup.select("a[href]"):
        href = str(anchor.get("href") or "").strip()
        if not href or href.lower().startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(page_url, href)
        if _same_origin(absolute, page_url) and _looks_like_catalog_link(anchor, absolute):
            found.add(absolute)

    # Prefer top-level catalog pages before individual categories. Those pages
    # normally expose the complete taxonomy and pagination needed by the crawler.
    return sorted(
        found,
        key=lambda value: (
            urlparse(value).path.rstrip("/").count("/"),
            len(urlparse(value).path),
            value,
        ),
    )[:MAX_CATALOG_URLS]


def _extract_api_candidates(page_url: str, text: str) -> set[str]:
    found: set[str] = set()
    for pattern in API_PATTERNS:
        for match in re.findall(pattern, text, flags=re.I):
            candidate = urljoin(page_url, match)
            if _same_origin(candidate, page_url) and not any(x in candidate for x in ("${", "{", "}")):
                found.add(candidate)

    # Catch common fetch/axios string literals even when they do not use /api/.
    for match in re.findall(
        r"""(?:fetch\s*\(\s*|axios\.(?:get|post|put|patch)\s*\(\s*)[\"']([^\"'<> ]+)[\"']""",
        text,
        flags=re.I,
    ):
        candidate = urljoin(page_url, match)
        lowered = candidate.lower()
        if _same_origin(candidate, page_url) and (
            "/api/" in lowered or "/graphql" in lowered or lowered.split("?", 1)[0].endswith(".json")
        ):
            found.add(candidate)
    return found


def _update_profile_from_html(
    profile: SourceProfile,
    page_url: str,
    html: str,
    found_api: set[str],
    found_feed: set[str],
    script_urls: set[str],
) -> None:
    soup = BeautifulSoup(html, "lxml")
    if page_url not in profile.discovery_pages:
        profile.discovery_pages.append(page_url)

    if not profile.product_jsonld:
        for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
            text = script.string or script.get_text() or ""
            if '\"Product\"' in text or "'Product'" in text:
                profile.product_jsonld = True
                break

    profile.embedded_json = profile.embedded_json or bool(
        soup.find("script", id="__NEXT_DATA__")
        or soup.find("script", attrs={"type": "application/json"})
        or re.search(r"window\.__[A-Z0-9_]+__\s*=", html)
    )
    profile.html_product_hints = profile.html_product_hints or bool(
        soup.select_one(
            '[itemtype*="schema.org/Product"], [data-product-id], '
            ".product-card, .product-item, .product"
        )
    )

    found_api.update(_extract_api_candidates(page_url, html))
    for catalog_url in extract_catalog_urls(page_url, html):
        if catalog_url not in profile.catalog_urls and len(profile.catalog_urls) < MAX_CATALOG_URLS:
            profile.catalog_urls.append(catalog_url)

    for tag in soup.find_all(["a", "link", "script"]):
        candidate = tag.get("href") or tag.get("src")
        if not candidate:
            continue
        absolute = urljoin(page_url, str(candidate))
        lowered = absolute.lower().split("?", 1)[0]
        if lowered.endswith(FEED_EXTENSIONS):
            found_feed.add(absolute)
        if "/api/" in lowered or "/graphql" in lowered:
            if _same_origin(absolute, page_url):
                found_api.add(absolute)
        if tag.name == "script" and tag.get("src") and _same_origin(absolute, page_url):
            script_urls.add(absolute)

    page_text = soup.get_text(" ", strip=True).lower()
    for label, pattern in AVAILABILITY_CONTEXT_PATTERNS:
        if label not in profile.availability_context_hints and re.search(pattern, page_text, flags=re.I):
            profile.availability_context_hints.append(label)


async def discover_sources(
    base_url: str,
    timeout_seconds: float = 20.0,
    budget_seconds: float | None = None,
) -> SourceProfile:
    """Discover first-party acquisition sources before product crawling.

    Discovery deliberately starts from the merchant website and its official
    catalog entrypoint. Expensive speculative probes use a much shorter timeout
    than actual product acquisition, so an absent feed/API cannot stall every
    crawl for minutes. Playwright remains the runtime XHR/fetch observer for
    endpoints that only appear interactively.
    """
    started = perf_counter()
    profile = SourceProfile(base_url=base_url)
    headers = {"User-Agent": "MoldovaCommerceBot/0.4 (+catalog-indexer)"}
    found_api: set[str] = set()
    found_feed: set[str] = set()
    script_urls: set[str] = set()
    deadline = started + budget_seconds if budget_seconds and budget_seconds > 0 else None
    probe_timeout = min(timeout_seconds, PROBE_TIMEOUT_SECONDS)
    catalog_timeout = min(timeout_seconds, CATALOG_PROBE_TIMEOUT_SECONDS)

    async with httpx.AsyncClient(
        timeout=timeout_seconds,
        follow_redirects=True,
        headers=headers,
    ) as client:
        policy = await load_robots_policy(client, base_url, probe_timeout)
        profile.robots_policy = policy
        profile.robots_status = policy.status
        profile.robots_url = policy.robots_url
        profile.robots_reason = policy.reason
        if not policy.base_allowed:
            profile.blocked = True
            return _finish_profile(profile, started)

        async def get_allowed(url: str, **kwargs) -> httpx.Response | None:
            if not policy.can_fetch(url):
                return None
            requested_timeout = float(kwargs.pop("timeout", timeout_seconds))
            if deadline is not None:
                remaining = deadline - perf_counter()
                if remaining <= 0:
                    profile.discovery_budget_exhausted = True
                    return None
                requested_timeout = min(requested_timeout, remaining)
            try:
                return await client.get(url, timeout=requested_timeout, **kwargs)
            except httpx.TimeoutException:
                if deadline is not None and perf_counter() >= deadline:
                    profile.discovery_budget_exhausted = True
                raise

        try:
            response = await get_allowed(base_url, timeout=probe_timeout)
        except httpx.HTTPError:
            profile.blocked = True
            return _finish_profile(profile, started)

        if response is None:
            return _finish_profile(profile, started)
        if response.status_code in (401, 403, 429):
            profile.blocked = True
        if response.is_success:
            _update_profile_from_html(
                profile,
                str(response.url),
                response.text,
                found_api,
                found_feed,
                script_urls,
            )

        # One top-level official catalog root is enough to expose the taxonomy
        # and scripts without turning discovery itself into a catalog crawl.
        inspected = set(profile.discovery_pages)
        for candidate in list(profile.catalog_urls)[:MAX_DISCOVERY_CATALOG_PAGES]:
            if candidate in inspected:
                continue
            try:
                catalog_response = await get_allowed(candidate, timeout=catalog_timeout)
            except httpx.HTTPError:
                continue
            if catalog_response is None or not catalog_response.is_success:
                continue
            inspected.add(str(catalog_response.url))
            _update_profile_from_html(
                profile,
                str(catalog_response.url),
                catalog_response.text,
                found_api,
                found_feed,
                script_urls,
            )

        # First-party bundles can reveal the JSON endpoint used by the storefront.
        # Keep the budget small; browser network observation handles dynamic cases.
        for script_url in sorted(script_urls)[:MAX_SCRIPT_ASSETS]:
            try:
                script_response = await get_allowed(script_url, timeout=probe_timeout)
            except httpx.HTTPError:
                continue
            if script_response is None or not script_response.is_success:
                continue
            ctype = script_response.headers.get("content-type", "").lower()
            if "javascript" not in ctype and not script_url.lower().split("?", 1)[0].endswith(".js"):
                continue
            found_api.update(_extract_api_candidates(script_url, script_response.text))

        # Linked feeds have already been captured above. Brute-force only a few
        # common feed names when the site gave us no stronger first-party source.
        if not found_feed and not found_api and not profile.catalog_urls:
            for path in COMMON_FEEDS:
                candidate = urljoin(base_url, path)
                try:
                    fr = await get_allowed(candidate, timeout=probe_timeout)
                except httpx.HTTPError:
                    continue
                if fr is None:
                    continue
                ctype = fr.headers.get("content-type", "").lower()
                if fr.is_success and (
                    "json" in ctype
                    or "xml" in ctype
                    or "csv" in ctype
                    or fr.text.lstrip().startswith(("{", "[", "<?xml", "<yml_catalog"))
                ):
                    found_feed.add(str(fr.url))

        # Validate only a bounded number of discovered API hints. An endpoint
        # requiring a body/auth is not treated as a usable GET acquisition source.
        validated_api: list[str] = []
        for candidate in sorted(found_api)[:MAX_API_VALIDATION]:
            try:
                ar = await get_allowed(candidate, timeout=probe_timeout)
            except httpx.HTTPError:
                continue
            if ar is None:
                continue
            ctype = ar.headers.get("content-type", "").lower()
            if ar.is_success and ("json" in ctype or ar.text.lstrip().startswith(("{", "["))):
                validated_api.append(str(ar.url))
        profile.api_hints = validated_api[:MAX_API_HINTS]
        profile.feed_hints = sorted(found_feed)[:MAX_FEED_HINTS]

        # The policy was fetched before discovery. Reuse its declared sitemaps
        # rather than fetching robots.txt again or treating an unavailable file
        # as permission to probe additional paths.
        robots_sitemaps = policy.parser.site_maps() if policy.parser else []
        candidates = robots_sitemaps or [
            urljoin(base_url, "/sitemap.xml"),
            urljoin(base_url, "/sitemap_index.xml"),
        ]
        for candidate in dict.fromkeys(candidates):
            try:
                sr = await get_allowed(candidate, timeout=probe_timeout)
                if sr is not None and sr.is_success and (
                    "xml" in sr.headers.get("content-type", "").lower()
                    or "<urlset" in sr.text
                    or "<sitemapindex" in sr.text
                ):
                    profile.sitemap_urls.append(str(sr.url))
            except httpx.HTTPError:
                continue

    # A catalog page discovered after following another catalog page can be more
    # specific; restore deterministic root-first order before handing it to the
    # generic crawler.
    profile.catalog_urls = sorted(
        dict.fromkeys(profile.catalog_urls),
        key=lambda value: (
            urlparse(value).path.rstrip("/").count("/"),
            len(urlparse(value).path),
            value,
        ),
    )[:MAX_CATALOG_URLS]
    return _finish_profile(profile, started)
