from __future__ import annotations

import argparse
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

from .category_mapper import map_category
from .connectors.base import ConnectorContext
from .connectors.registry import build_connector_plan
from .normalizer import normalize
from .source_discovery import discover_sources

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "data" / "store-registry.json"
OUT_DIR = ROOT / "data" / "raw"
REPORT_DIR = ROOT / "data" / "reports"


def load_store(slug: str) -> dict:
    stores = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for store in stores:
        if store["slug"] == slug:
            return store
    raise SystemExit(f"Store '{slug}' not found in registry")


def pct(part: int, total: int) -> float:
    return round((part / total) * 100, 2) if total else 0.0


async def crawl(store_slug: str, limit: int, browser_threshold: float = 0.8) -> None:
    started_at = datetime.now(timezone.utc)
    started = perf_counter()
    store = load_store(store_slug)
    context = ConnectorContext(store_slug=store_slug, base_url=store["domain"], requests_per_second=1.0)
    profile = await discover_sources(store["domain"], timeout_seconds=context.timeout_seconds)
    plan = build_connector_plan(context, profile)
    browser_trigger_count = max(1, min(limit, int(limit * browser_threshold)))

    print(
        f"[DISCOVERY] {store_slug}: strategies={[x.name for x in plan]}; "
        f"sitemaps={len(profile.sitemap_urls)}; jsonld={profile.product_jsonld}; "
        f"embedded_json={profile.embedded_json}; html_hints={profile.html_product_hints}; "
        f"api_hints={len(profile.api_hints)}; feeds={len(getattr(profile, 'feed_urls', []))}; blocked={profile.blocked}"
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / f"{store_slug}.ndjson"
    report_path = REPORT_DIR / f"{store_slug}.json"

    seen_products: set[str] = set()
    products_written = 0
    with_price = 0
    with_known_stock = 0
    with_image = 0
    with_category = 0
    with_identity = 0
    with_branch_availability = 0
    branch_availability_rows = 0
    errors = 0
    strategy_stats: list[dict] = []

    with output.open("w", encoding="utf-8") as fh:
        for choice in plan:
            if choice.name == "browser-rendered" and products_written >= browser_trigger_count:
                strategy_stats.append({
                    "connector": choice.name,
                    "priority": choice.priority,
                    "reason": choice.reason,
                    "urls_checked": 0,
                    "accepted": 0,
                    "duplicates": 0,
                    "errors": 0,
                    "skipped": True,
                    "skip_reason": f"coverage threshold reached ({products_written}/{browser_trigger_count})",
                })
                print(f"[SKIP] {choice.name}: coverage threshold reached ({products_written}/{browser_trigger_count})")
                continue

            urls_seen = 0
            accepted = 0
            duplicates = 0
            strategy_errors = 0
            print(f"[TRY] priority={choice.priority} connector={choice.name}: {choice.reason}")

            try:
                async for url in choice.connector.discover_product_urls():
                    if products_written >= limit:
                        break
                    urls_seen += 1
                    try:
                        raw = await choice.connector.fetch_product(url)
                    except Exception as exc:
                        errors += 1
                        strategy_errors += 1
                        print(f"[WARN:{choice.name}] {url}: {exc}")
                        continue
                    if raw is None:
                        continue

                    category_slug, category_confidence = map_category(raw.category_path, raw.title)
                    item = normalize(raw, category_slug=category_slug)
                    dedupe_key = item.ean or (f"mpn:{item.normalized_brand}:{item.mpn}" if item.mpn else None) or f"{item.store_slug}:{item.external_id or item.url}"
                    if dedupe_key in seen_products:
                        duplicates += 1
                        continue
                    seen_products.add(dedupe_key)

                    payload = item.model_dump(mode="json")
                    payload["category_confidence"] = category_confidence
                    payload["source_connector"] = choice.name
                    payload["source_priority"] = choice.priority
                    fh.write(json.dumps(payload, ensure_ascii=False) + "\n")

                    products_written += 1
                    accepted += 1
                    with_price += int(item.price is not None and item.price >= 0)
                    with_known_stock += int(str(item.stock_status.value) != "UNKNOWN")
                    with_image += int(item.image_url is not None)
                    with_category += int(item.category_slug is not None)
                    with_identity += int(bool(item.ean or item.mpn or item.sku))
                    if item.availabilities:
                        with_branch_availability += 1
                        branch_availability_rows += len(item.availabilities)
                    print(f"[{products_written}] {item.title} — {item.price} {item.currency} — {category_slug or 'unmapped'} [{choice.name}]")
            except Exception as exc:
                errors += 1
                strategy_errors += 1
                print(f"[STRATEGY FAIL] {choice.name}: {exc}")

            strategy_stats.append({
                "connector": choice.name,
                "priority": choice.priority,
                "reason": choice.reason,
                "urls_checked": urls_seen,
                "accepted": accepted,
                "duplicates": duplicates,
                "errors": strategy_errors,
                "skipped": False,
            })
            print(f"[RESULT] {choice.name}: checked={urls_seen}, accepted={accepted}, duplicates={duplicates}, errors={strategy_errors}")

            if products_written >= limit:
                break

    duration = round(perf_counter() - started, 3)
    report = {
        "store_slug": store_slug,
        "store_name": store.get("name"),
        "domain": store.get("domain"),
        "started_at": started_at.isoformat(),
        "duration_seconds": duration,
        "limit": limit,
        "browser_fallback": {
            "threshold_ratio": browser_threshold,
            "trigger_below_products": browser_trigger_count,
        },
        "discovery": {
            "blocked": profile.blocked,
            "sitemaps": profile.sitemap_urls,
            "api_hints": profile.api_hints,
            "feed_urls": getattr(profile, "feed_urls", []),
            "product_jsonld": profile.product_jsonld,
            "embedded_json": profile.embedded_json,
            "html_product_hints": profile.html_product_hints,
        },
        "strategies": strategy_stats,
        "quality": {
            "unique_products": products_written,
            "target_fill_pct": pct(products_written, limit),
            "price_complete_pct": pct(with_price, products_written),
            "known_stock_pct": pct(with_known_stock, products_written),
            "image_complete_pct": pct(with_image, products_written),
            "category_complete_pct": pct(with_category, products_written),
            "identity_complete_pct": pct(with_identity, products_written),
            "branch_availability_product_pct": pct(with_branch_availability, products_written),
            "branch_availability_rows": branch_availability_rows,
            "errors": errors,
        },
        "output": str(output.relative_to(ROOT)),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    stats = ", ".join(f"{s['connector']}:{s['accepted']}/{s['urls_checked']}" for s in strategy_stats)
    print(f"Done. Wrote {products_written} unique products to {output}. Strategies: {stats}")
    print(
        f"Quality: target={report['quality']['target_fill_pct']}%, price={report['quality']['price_complete_pct']}%, "
        f"stock={report['quality']['known_stock_pct']}%, image={report['quality']['image_complete_pct']}%, "
        f"category={report['quality']['category_complete_pct']}%, identity={report['quality']['identity_complete_pct']}%, "
        f"branch_stock={report['quality']['branch_availability_product_pct']}%."
    )
    print(f"Report: {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl one registry store using prioritized adaptive acquisition")
    parser.add_argument("--store", required=True, help="Store slug from data/store-registry.json")
    parser.add_argument("--limit", type=int, default=100, help="Maximum unique products to collect")
    parser.add_argument(
        "--browser-threshold",
        type=float,
        default=0.8,
        help="Use browser fallback only when earlier strategies collect less than this fraction of --limit (0..1)",
    )
    args = parser.parse_args()
    threshold = min(1.0, max(0.0, args.browser_threshold))
    asyncio.run(crawl(args.store, max(1, args.limit), browser_threshold=threshold))


if __name__ == "__main__":
    main()
