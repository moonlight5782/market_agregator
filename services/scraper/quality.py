from __future__ import annotations

from collections import Counter
from typing import Any


def pct(part: int, total: int) -> float:
    return round((part / total) * 100, 2) if total else 0.0


def compute_quality(payloads: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    total = len(payloads)
    image_urls = [str(item["image_url"]) for item in payloads if item.get("image_url")]
    image_counts = Counter(image_urls)
    max_image_reuse = max(image_counts.values(), default=0)

    with_branch_availability = sum(1 for item in payloads if item.get("availabilities"))
    branch_rows = sum(len(item.get("availabilities") or []) for item in payloads)
    network_observed = 0
    network_matched = 0
    network_response_total = 0
    for item in payloads:
        attributes = item.get("attributes") or {}
        responses = int(attributes.get("network_json_responses") or 0)
        if responses > 0:
            network_observed += 1
            network_response_total += responses
        if attributes.get("network_json_product_match") is True:
            network_matched += 1

    return {
        "unique_products": total,
        "target_fill_pct": pct(total, limit),
        "price_complete_pct": pct(sum(1 for item in payloads if item.get("price") is not None), total),
        "known_stock_pct": pct(sum(1 for item in payloads if item.get("stock_status") not in (None, "UNKNOWN")), total),
        "image_complete_pct": pct(len(image_urls), total),
        "distinct_image_pct": pct(len(image_counts), len(image_urls)),
        "max_image_reuse_pct": pct(max_image_reuse, len(image_urls)),
        "category_complete_pct": pct(sum(1 for item in payloads if item.get("category_slug")), total),
        "identity_complete_pct": pct(sum(1 for item in payloads if item.get("ean") or item.get("mpn") or item.get("sku")), total),
        "branch_availability_product_pct": pct(with_branch_availability, total),
        "branch_availability_rows": branch_rows,
        "network_json_observed_product_pct": pct(network_observed, total),
        "network_json_matched_product_pct": pct(network_matched, total),
        "network_json_response_count": network_response_total,
    }


def browser_enrichment_reasons(quality: dict[str, Any]) -> list[str]:
    if quality.get("unique_products", 0) <= 0:
        return []

    reasons: list[str] = []
    known_stock = float(quality.get("known_stock_pct", 0.0))
    category = float(quality.get("category_complete_pct", 0.0))
    identity = float(quality.get("identity_complete_pct", 0.0))
    image_complete = float(quality.get("image_complete_pct", 0.0))
    image_reuse = float(quality.get("max_image_reuse_pct", 0.0))

    if known_stock < 20.0:
        reasons.append(f"known_stock={known_stock}%")
    if identity < 50.0:
        reasons.append(f"identity={identity}%")
    if category < 70.0:
        reasons.append(f"category={category}%")
    if image_complete >= 50.0 and image_reuse >= 80.0:
        reasons.append(f"image_reuse={image_reuse}%")

    return reasons


def merge_product_payload(
    existing: dict[str, Any],
    candidate: dict[str, Any],
    *,
    replace_suspicious_image: bool = False,
) -> tuple[dict[str, Any], bool]:
    merged = dict(existing)
    changed = False

    def fill(field: str) -> None:
        nonlocal changed
        if not merged.get(field) and candidate.get(field):
            merged[field] = candidate[field]
            changed = True

    for field in ("brand", "sku", "ean", "mpn", "location_external_id"):
        fill(field)

    existing_description = str(merged.get("description") or "")
    candidate_description = str(candidate.get("description") or "")
    if candidate_description and len(candidate_description) > len(existing_description):
        merged["description"] = candidate.get("description")
        changed = True

    existing_stock = merged.get("stock_status")
    candidate_stock = candidate.get("stock_status")
    if existing_stock in (None, "UNKNOWN") and candidate_stock not in (None, "UNKNOWN"):
        merged["stock_status"] = candidate_stock
        changed = True
    if merged.get("quantity") is None and candidate.get("quantity") is not None:
        merged["quantity"] = candidate["quantity"]
        changed = True

    existing_image = merged.get("image_url")
    candidate_image = candidate.get("image_url")
    if candidate_image and (not existing_image or (replace_suspicious_image and candidate_image != existing_image)):
        merged["image_url"] = candidate_image
        changed = True

    existing_confidence = float(merged.get("category_confidence") or 0.0)
    candidate_confidence = float(candidate.get("category_confidence") or 0.0)
    if candidate.get("category_slug") and (not merged.get("category_slug") or candidate_confidence > existing_confidence):
        merged["category_slug"] = candidate["category_slug"]
        merged["category_confidence"] = candidate_confidence
        if candidate.get("category_path"):
            merged["category_path"] = candidate["category_path"]
        changed = True

    candidate_availability = candidate.get("availabilities") or []
    if candidate_availability and not (merged.get("availabilities") or []):
        merged["availabilities"] = candidate_availability
        changed = True

    existing_attributes = merged.get("attributes") or {}
    candidate_attributes = candidate.get("attributes") or {}
    if candidate_attributes:
        combined_attributes = {**existing_attributes, **candidate_attributes}
        if combined_attributes != existing_attributes:
            merged["attributes"] = combined_attributes
            changed = True

    if candidate.get("data_quality") is not None and float(candidate["data_quality"]) > float(merged.get("data_quality") or 0.0):
        merged["data_quality"] = candidate["data_quality"]
        changed = True

    if changed:
        enriched_by = list(merged.get("enriched_by") or [])
        source = candidate.get("source_connector") or "browser-rendered"
        if source not in enriched_by:
            enriched_by.append(source)
        merged["enriched_by"] = enriched_by

    return merged, changed
