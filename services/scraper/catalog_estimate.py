from __future__ import annotations

from dataclasses import asdict, dataclass
import re
from urllib.parse import urljoin

import httpx


@dataclass(frozen=True)
class CatalogEstimate:
    value: int | None
    kind: str
    source_url: str | None
    method: str

    def as_dict(self) -> dict:
        return asdict(self)


def _number(value: str) -> int:
    return int(re.sub(r"\D", "", value))


def parse_catalog_estimate(store_slug: str, text: str, source_url: str) -> CatalogEstimate:
    patterns: dict[str, tuple[str, str, str]] = {
        "darwin": (r"(?:Найдено товаров|Produse găsite)\s*:?\s*([\d\s.,]+)", "exact", "public empty-search result count"),
        "maximum": (r"(?:Поиск среди|Căutare printre)\s*([\d\s.,]+)\s*(?:товар|produse)", "exact", "public catalog search count"),
        "supraten": (r"(?:Свыше|Более|Peste|Mai mult de)\s*([\d\s.,]+)\s*(?:товар|produse)", "lower-bound", "merchant public catalog-size claim"),
    }
    config = patterns.get(store_slug)
    if not config:
        return CatalogEstimate(None, "unknown", source_url, "no public reference-count parser")
    pattern, kind, method = config
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return CatalogEstimate(None, "unknown", source_url, f"{method}; count not found")
    try:
        value = _number(match.group(1))
    except ValueError:
        return CatalogEstimate(None, "unknown", source_url, f"{method}; invalid count")
    return CatalogEstimate(value, kind, source_url, method)


async def estimate_catalog_size(store_slug: str, base_url: str, timeout_seconds: float = 20.0) -> CatalogEstimate:
    paths = {
        "darwin": "/ru/poisk",
        "maximum": "/ru/",
        "supraten": "/",
    }
    path = paths.get(store_slug)
    if not path:
        return CatalogEstimate(None, "unknown", None, "no public reference-count endpoint configured")
    url = urljoin(base_url.rstrip("/") + "/", path.lstrip("/"))
    try:
        async with httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=True,
            headers={"User-Agent": "MoldovaCommerceCatalogAudit/1.0 (+coverage-validation)"},
        ) as client:
            response = await client.get(url)
            if not response.is_success:
                return CatalogEstimate(None, "unknown", str(response.url), f"reference endpoint HTTP {response.status_code}")
            return parse_catalog_estimate(store_slug, response.text, str(response.url))
    except Exception as exc:
        return CatalogEstimate(None, "unknown", url, f"reference request failed: {type(exc).__name__}")
