from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from difflib import SequenceMatcher

from .models import NormalizedProduct


class MatchMethod(str, Enum):
    EAN = "EAN"
    MPN = "MPN"
    SKU = "SKU"
    BRAND_MODEL = "BRAND_MODEL"
    NORMALIZED_TITLE = "NORMALIZED_TITLE"
    FUZZY = "FUZZY"


@dataclass(frozen=True)
class MatchResult:
    confidence: float
    method: MatchMethod
    auto_merge: bool


def compare(a: NormalizedProduct, b: NormalizedProduct) -> MatchResult | None:
    if a.ean and b.ean and a.ean == b.ean:
        return MatchResult(1.0, MatchMethod.EAN, True)
    if a.mpn and b.mpn and a.mpn == b.mpn and a.normalized_brand == b.normalized_brand:
        return MatchResult(0.98, MatchMethod.MPN, True)
    if a.sku and b.sku and a.sku == b.sku and a.normalized_brand == b.normalized_brand:
        return MatchResult(0.95, MatchMethod.SKU, True)
    if a.normalized_title == b.normalized_title:
        return MatchResult(0.93, MatchMethod.NORMALIZED_TITLE, True)

    similarity = SequenceMatcher(None, a.normalized_title, b.normalized_title).ratio()
    same_brand = bool(a.normalized_brand and a.normalized_brand == b.normalized_brand)
    confidence = min(0.94, similarity + (0.05 if same_brand else 0))
    if confidence < 0.75:
        return None
    return MatchResult(round(confidence, 3), MatchMethod.FUZZY, confidence >= 0.90)
