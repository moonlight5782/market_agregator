from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from .catalog_estimate import estimate_catalog_size

ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "data" / "reports"
REGISTRY = ROOT / "data" / "store-registry.json"


def pct(part: int, total: int) -> float | None:
    return round(part / total * 100, 4) if total > 0 else None


def load_store(slug: str) -> dict:
    stores = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for store in stores:
        if store.get("slug") == slug:
            return store
    raise KeyError(slug)


async def audit_store(slug: str) -> dict:
    store = load_store(slug)
    report_path = REPORT_DIR / f"{slug}.json"
    if not report_path.exists():
        return {"store": slug, "status": "FAILED", "reason": "crawl report missing"}

    report = json.loads(report_path.read_text(encoding="utf-8"))
    estimate = await estimate_catalog_size(slug, store["domain"])
    collected = int(report.get("quality", {}).get("unique_products", 0) or 0)
    limit = int(report.get("limit", 0) or 0)
    observed_ratio = pct(collected, estimate.value) if estimate.value else None

    # A capped smoke sample is useful for parser quality but cannot prove full coverage.
    capped_before_reference = bool(estimate.value and limit and limit < estimate.value and collected >= limit)
    verification_ready = bool(
        estimate.kind == "exact"
        and estimate.value
        and collected >= estimate.value
        and not capped_before_reference
        and report.get("quality", {}).get("errors", 0) == 0
    )

    return {
        "store": slug,
        "status": "VERIFIED" if verification_ready else "PARTIAL",
        "catalog_estimate": estimate.value,
        "catalog_estimate_kind": estimate.kind,
        "catalog_estimate_method": estimate.method,
        "catalog_estimate_source": estimate.source_url,
        "collected": collected,
        "crawl_limit": limit,
        "observed_catalog_ratio_pct": observed_ratio,
        "verification_ready": verification_ready,
        "verification_blocker": None if verification_ready else (
            "smoke run capped below catalog reference" if capped_before_reference
            else "catalog reference is not exact" if estimate.kind != "exact"
            else "crawl did not reach catalog reference" if estimate.value and collected < estimate.value
            else "catalog reference unavailable"
        ),
        "quality": report.get("quality", {}),
        "strategies": report.get("strategies", []),
        "duration_seconds": report.get("duration_seconds"),
        "report_path": str(report_path.relative_to(ROOT)),
    }


async def main_async(stores: list[str], output: Path) -> None:
    results = [await audit_store(slug) for slug in stores]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="Combine crawl quality with independent public catalog-size references")
    parser.add_argument("--stores", nargs="+", default=["darwin", "maximum", "cactus", "supraten"])
    parser.add_argument("--output", default="data/reports/_coverage-audit.json")
    args = parser.parse_args()
    asyncio.run(main_async(args.stores, ROOT / args.output))


if __name__ == "__main__":
    main()
