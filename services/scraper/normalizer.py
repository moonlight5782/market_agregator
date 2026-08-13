from __future__ import annotations

import re
import unicodedata

from .models import NormalizedProduct, RawProduct


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).strip().lower()
    value = re.sub(r"[^\w\s.+/-]", " ", value, flags=re.UNICODE)
    return re.sub(r"\s+", " ", value).strip()


_NON_PRODUCT_SERVICE_PATTERNS = (
    r"\bсоставлени[ея]\b.*\b(индивидуальн\w*\s+)?курс\w*\b",
    r"\b(consultation|consulting|service\s+booking)\b",
    r"\b(консультаци\w*|запись\s+на\s+услуг\w*)\b",
)


def is_non_product_service(item: RawProduct) -> bool:
    """Return true only for clearly named services, not physical merchandise."""
    title = normalize_text(item.title)
    return any(re.search(pattern, title, flags=re.IGNORECASE) for pattern in _NON_PRODUCT_SERVICE_PATTERNS)


def quality_score(item: RawProduct) -> float:
    has_branch_quantity = any(availability.quantity is not None for availability in item.availabilities)
    weighted = {
        "title": (bool(item.title), 0.15),
        "price": (item.price >= 0, 0.15),
        "url": (bool(item.url), 0.10),
        "brand": (bool(item.brand), 0.10),
        "identifier": (bool(item.ean or item.mpn or item.sku), 0.15),
        "category": (bool(item.category_path), 0.10),
        "image": (bool(item.image_url), 0.05),
        "stock": (item.stock_status.value != "UNKNOWN", 0.10),
        "quantity": (item.quantity is not None or has_branch_quantity, 0.05),
        "location": (item.location_external_id is not None or bool(item.availabilities), 0.05),
    }
    return round(sum(weight for ok, weight in weighted.values() if ok), 2)


def normalize(item: RawProduct, category_slug: str | None = None) -> NormalizedProduct:
    data = item.model_dump()
    return NormalizedProduct(
        **data,
        normalized_title=normalize_text(item.title),
        normalized_brand=normalize_text(item.brand) if item.brand else None,
        category_slug=category_slug,
        data_quality=quality_score(item),
    )
