from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from urllib.parse import urlparse

from .catalog_estimate import estimate_catalog_size
from .category_mapper import map_category
from .connectors.base import ConnectorContext
from .connectors.registry import build_connector_plan
from .normalizer import normalize
from .quality import browser_enrichment_reasons, compute_quality, merge_product_payload, publish_readiness
from .source_discovery import discover_sources

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "data" / "store-registry.json"
OUT_DIR = ROOT / "data" / "raw"
REPORT_DIR = ROOT / "data" / "reports"
PRODUCT_FETCH_CONCURRENCY = 6


def load_store(slug: str) -> dict:
    stores = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for store in stores:
        if store["slug"] == slug:
            return store
    raise SystemExit(f"Store '{slug}' not found in registry")


def store_from_url(url: str, slug: str | None = None) -> dict:
    parsed = urlparse(url if "://" in url else f"https://{url}")
    if not parsed.netloc:
        raise SystemExit(f"Invalid store URL: {url}")
    base_url = f"{parsed.scheme or 'https'}://{parsed.netloc}"
    derived = parsed.netloc.lower().removeprefix("www.").split(".", 1)[0]
    safe_slug = re.sub(r"[^a-z0-9-]+", "-", (slug or derived).lower()).strip("-") or "external-store"
    return {
        "slug": safe_slug,
        "name": parsed.netloc,
        "domain": base_url,
        "status": "UNREGISTERED",
    }


def _map_raw_category(raw) -> tuple[str | None, float]:
    source = raw.attributes.get("category_path_source") if isinstance(raw.attributes, dict) else None
    return map_category(
        raw.category_path,
        raw.title,
        category_path_is_breadcrumb=source != "url",
    )


def _strategy_fetch_concurrency(connector_name: str) -> int:
    # Playwright is memory-heavy and can trigger many subrequests per page.
    # Keep browser rendering single-flight even when HTTP detail pages are
    # fetched concurrently.
    return 1 if connector_name == "browser-rendered" else PRODUCT_FETCH_CONCURRENCY


async def _fetch_batch(connector, urls: list[str]):
    """Fetch detail pages concurrently while connector-level start-rate limiting remains authoritative."""
    return await asyncio.gather(
        *(connector.fetch_product(url) for url in urls),
        return_exceptions=True,
    )


async def crawl(
    store_slug: str,
    limit: int,
    browser_threshold: float = 0.8,
    browser_enrichment_limit: int = 5,
    store_url: str | None = None,
) -> tuple[str, int]:
    started_at = datetime.now(timezone.utc)
    started = perf_counter()
    store = store_from_url(store_url, store_slug) if store_url else load_store(store_slug)
    store_slug = store["slug"]
    context = ConnectorContext(store_slug=store_slug, base_url=store["domain"], requests_per_second=1.0)
    profile = await discover_sources(store["domain"], timeout_seconds=context.timeout_seconds)
    context = ConnectorContext(
        store_slug=store_slug,
        base_url=store["domain"],
        requests_per_second=1.0,
        timeout_seconds=context.timeout_seconds,
        robots_policy=profile.robots_policy,
    )
    bounded = limit > 0
    browser_trigger_count = max(1, min(limit, int(limit * browser_threshold))) if bounded else 1
    browser_enrichment_limit = max(0, browser_enrichment_limit)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / f"{store_slug}.ndjson"
    report_path = REPORT_DIR / f"{store_slug}.json"
    robots = profile.robots_policy
    if robots is None or not robots.base_allowed:
        output.write_text("", encoding="utf-8")
        duration = round(perf_counter() - started, 3)
        report = {
            "store_slug": store_slug,
            "store_name": store.get("name"),
            "domain": store.get("domain"),
            "registry_status": store.get("status"),
            "started_at": started_at.isoformat(),
            "duration_seconds": duration,
            "limit": limit,
            "crawl_mode": "bounded" if bounded else "full",
            "outcome": "BLOCKED_BY_ROBOTS",
            "publish_readiness": {"ready": False, "blockers": [robots.reason if robots else "robots policy was not loaded"]},
            "discovery": {
                "blocked": True,
                "robots": {
                    "status": robots.status if robots else "UNAVAILABLE",
                    "url": robots.robots_url if robots else None,
                    "reason": robots.reason if robots else "robots policy was not loaded",
                },
            },
            "strategies": [],
            "quality": {"total": 0, "errors": 0},
            "output": str(output.relative_to(ROOT)),
        }
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[ROBOTS BLOCK] {store_slug}: {report['publish_readiness']['blockers'][0]}; report={report_path}")
        return "BLOCKED_BY_ROBOTS", 0

    plan = build_connector_plan(context, profile)
    print(
        f"[DISCOVERY] {store_slug}: strategies={[x.name for x in plan]}; "
        f"sitemaps={len(profile.sitemap_urls)}; jsonld={profile.product_jsonld}; "
        f"embedded_json={profile.embedded_json}; html_hints={profile.html_product_hints}; "
        f"api_hints={len(profile.api_hints)}; feeds={len(profile.feed_hints)}; robots={profile.robots_status}; blocked={profile.blocked}; "
        f"mode={'bounded' if bounded else 'full'}; http_detail_concurrency={PRODUCT_FETCH_CONCURRENCY}"
    )

    seen_products: set[str] = set()
    products_written = 0
    errors = 0
    strategy_stats: list[dict] = []

    with output.open("w", encoding="utf-8") as fh:
        for choice in plan:
            if choice.name == "browser-rendered" and bounded and products_written >= browser_trigger_count:
                strategy_stats.append({
                    "connector": choice.name,
                    "priority": choice.priority,
                    "reason": choice.reason,
                    "urls_checked": 0,
                    "accepted": 0,
                    "duplicates": 0,
                    "errors": 0,
                    "skipped": True,
                    "exhausted": False,
                    "skip_reason": f"bounded coverage threshold reached ({products_written}/{browser_trigger_count})",
                })
                print(f"[SKIP] {choice.name}: bounded coverage threshold reached ({products_written}/{browser_trigger_count})")
                continue

            urls_seen = 0
            accepted = 0
            duplicates = 0
            strategy_errors = 0
            stopped_by_cap = False
            source_exhausted = False
            strategy_started = perf_counter()
            strategy_concurrency = _strategy_fetch_concurrency(choice.name)
            print(
                f"[TRY] priority={choice.priority} connector={choice.name}: {choice.reason}; "
                f"detail_concurrency={strategy_concurrency}"
            )

            try:
                url_iter = choice.connector.discover_product_urls().__aiter__()
                while not source_exhausted:
                    if bounded and products_written >= limit:
                        stopped_by_cap = True
                        break

                    remaining = max(1, limit - products_written) if bounded else strategy_concurrency
                    batch_target = min(strategy_concurrency, remaining)
                    urls: list[str] = []
                    for _ in range(batch_target):
                        try:
                            urls.append(await anext(url_iter))
                        except StopAsyncIteration:
                            source_exhausted = True
                            break
                    if not urls:
                        break

                    urls_seen += len(urls)
                    results = await _fetch_batch(choice.connector, urls)
                    for url, raw_or_exc in zip(urls, results):
                        if isinstance(raw_or_exc, BaseException):
                            errors += 1
                            strategy_errors += 1
                            print(f"[WARN:{choice.name}] {url}: {raw_or_exc}")
                            continue
                        raw = raw_or_exc
                        if raw is None:
                            continue

                        category_slug, category_confidence = _map_raw_category(raw)
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
                        print(f"[{products_written}] {item.title} — {item.price} {item.currency} — {category_slug or 'unmapped'} [{choice.name}]")
                        if bounded and products_written >= limit:
                            stopped_by_cap = True
                            break
            except Exception as exc:
                errors += 1
                strategy_errors += 1
                print(f"[STRATEGY FAIL] {choice.name}: {exc}")

            strategy_duration = round(perf_counter() - strategy_started, 3)
            strategy_stats.append({
                "connector": choice.name,
                "priority": choice.priority,
                "reason": choice.reason,
                "urls_checked": urls_seen,
                "accepted": accepted,
                "duplicates": duplicates,
                "errors": strategy_errors,
                "skipped": False,
                "exhausted": source_exhausted and not stopped_by_cap,
                "duration_seconds": strategy_duration,
                "detail_fetch_concurrency": strategy_concurrency,
            })
            print(
                f"[RESULT] {choice.name}: checked={urls_seen}, accepted={accepted}, duplicates={duplicates}, "
                f"errors={strategy_errors}, exhausted={source_exhausted and not stopped_by_cap}, duration={strategy_duration}s"
            )

            if bounded and products_written >= limit:
                break

    payloads = [json.loads(line) for line in output.read_text(encoding="utf-8").splitlines() if line.strip()]
    initial_quality = compute_quality(payloads, limit)
    enrichment_reasons = browser_enrichment_reasons(initial_quality)
    browser_choice = next((choice for choice in plan if choice.name == "browser-rendered"), None)
    browser_already_ran = any(
        stat.get("connector") == "browser-rendered" and not stat.get("skipped", False)
        for stat in strategy_stats
    )
    enrichment_attempted = False
    enriched_products = 0

    if (
        browser_choice is not None
        and payloads
        and enrichment_reasons
        and not browser_already_ran
        and browser_enrichment_limit > 0
    ):
        enrichment_attempted = True
        enrichment_checked = 0
        enrichment_errors = 0
        suspicious_image_reuse = float(initial_quality.get("max_image_reuse_pct", 0.0)) >= 80.0
        print(
            f"[QUALITY] browser enrichment triggered: {', '.join(enrichment_reasons)}; "
            f"checking up to {min(browser_enrichment_limit, len(payloads))} existing product pages"
        )

        for index, existing in enumerate(payloads[:browser_enrichment_limit]):
            enrichment_checked += 1
            try:
                raw = await browser_choice.connector.fetch_product(str(existing["url"]))
            except Exception as exc:
                errors += 1
                enrichment_errors += 1
                print(f"[WARN:browser-enrichment] {existing.get('url')}: {exc}")
                continue
            if raw is None:
                continue

            category_slug, category_confidence = _map_raw_category(raw)
            item = normalize(raw, category_slug=category_slug)
            candidate = item.model_dump(mode="json")
            candidate["category_confidence"] = category_confidence
            candidate["source_connector"] = browser_choice.name
            candidate["source_priority"] = browser_choice.priority
            merged, changed = merge_product_payload(
                existing,
                candidate,
                replace_suspicious_image=suspicious_image_reuse,
            )
            if changed:
                payloads[index] = merged
                enriched_products += 1

        output.write_text(
            "".join(json.dumps(payload, ensure_ascii=False) + "\n" for payload in payloads),
            encoding="utf-8",
        )
        strategy_stats = [stat for stat in strategy_stats if stat.get("connector") != "browser-rendered"]
        strategy_stats.append({
            "connector": browser_choice.name,
            "priority": browser_choice.priority,
            "reason": browser_choice.reason,
            "mode": "quality-enrichment",
            "trigger_reasons": enrichment_reasons,
            "urls_checked": enrichment_checked,
            "accepted": 0,
            "duplicates": enrichment_checked,
            "enriched": enriched_products,
            "errors": enrichment_errors,
            "skipped": False,
            "exhausted": True,
            "detail_fetch_concurrency": 1,
        })
        print(
            f"[RESULT] browser quality enrichment: checked={enrichment_checked}, "
            f"enriched={enriched_products}, errors={enrichment_errors}"
        )

    products_written = len(payloads)
    quality = compute_quality(payloads, limit)
    quality["errors"] = errors

    estimate = await estimate_catalog_size(store_slug, store["domain"], timeout_seconds=context.timeout_seconds)
    cap_reached = bounded and products_written >= limit
    coverage_verified = bool(
        estimate.kind == "exact"
        and estimate.value
        and products_written >= estimate.value
        and (not bounded or limit >= estimate.value)
        and errors == 0
    )
    readiness = publish_readiness(quality, coverage_verified=coverage_verified, require_stock=True)

    duration = round(perf_counter() - started, 3)
    if products_written == 0:
        outcome = "BLOCKED_BY_ORIGIN" if profile.blocked else "NO_PRODUCTS"
    elif readiness["ready"]:
        outcome = "OK"
    else:
        outcome = "PARTIAL"

    report = {
        "store_slug": store_slug,
        "store_name": store.get("name"),
        "domain": store.get("domain"),
        "registry_status": store.get("status"),
        "started_at": started_at.isoformat(),
        "duration_seconds": duration,
        "limit": limit,
        "crawl_mode": "bounded" if bounded else "full",
        "http_detail_fetch_concurrency": PRODUCT_FETCH_CONCURRENCY,
        "browser_detail_fetch_concurrency": 1,
        "outcome": outcome,
        "coverage": {
            "verified": coverage_verified,
            "catalog_estimate": estimate.value,
            "catalog_estimate_kind": estimate.kind,
            "catalog_estimate_method": estimate.method,
            "catalog_estimate_source": estimate.source_url,
            "bounded": bounded,
            "cap_reached": cap_reached,
        },
        "publish_readiness": readiness,
        "browser_fallback": {
            "threshold_ratio": browser_threshold,
            "trigger_below_products": browser_trigger_count if bounded else None,
            "quality_enrichment_limit": browser_enrichment_limit,
            "quality_trigger_reasons": enrichment_reasons,
            "quality_enrichment_attempted": enrichment_attempted,
            "enriched_products": enriched_products,
        },
        "discovery": {
            "blocked": profile.blocked,
            "robots": {
                "status": profile.robots_status,
                "url": profile.robots_url,
                "reason": profile.robots_reason,
            },
            "sitemaps": profile.sitemap_urls,
            "api_hints": profile.api_hints,
            "feed_urls": profile.feed_hints,
            "product_jsonld": profile.product_jsonld,
            "embedded_json": profile.embedded_json,
            "html_product_hints": profile.html_product_hints,
        },
        "strategies": strategy_stats,
        "quality": quality,
        "output": str(output.relative_to(ROOT)),
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    stats = ", ".join(f"{s['connector']}:{s.get('accepted', 0)}/{s.get('urls_checked', 0)}" for s in strategy_stats)
    print(f"Done. outcome={outcome}. Wrote {products_written} unique products to {output}. Strategies: {stats}")
    print(
        f"Quality: target={quality['target_fill_pct']}%, price={quality['price_complete_pct']}%, "
        f"stock={quality['known_stock_pct']}%, image={quality['image_complete_pct']}%, "
        f"distinct_images={quality['distinct_image_pct']}%, max_image_reuse={quality['max_image_reuse_pct']}%, "
        f"category={quality['category_complete_pct']}%, identity={quality['identity_complete_pct']}%, "
        f"branch_stock={quality['branch_availability_product_pct']}%."
    )
    print(f"Coverage verified={coverage_verified}; publish_ready={readiness['ready']}; blockers={readiness['blockers']}")
    print(f"Report: {report_path}")
    return outcome, products_written


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl a registry store or any storefront URL using prioritized adaptive acquisition")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--store", help="Store slug from data/store-registry.json")
    source.add_argument("--url", help="Arbitrary storefront URL; no registry entry required")
    parser.add_argument("--slug", help="Optional slug when using --url")
    parser.add_argument("--limit", type=int, default=0, help="Maximum unique products to collect; 0 means full uncapped crawl")
    parser.add_argument(
        "--browser-threshold",
        type=float,
        default=0.8,
        help="For bounded diagnostics, use browser fallback below this fraction of --limit (0..1)",
    )
    parser.add_argument(
        "--browser-enrichment-limit",
        type=int,
        default=5,
        help="Maximum existing product pages to re-render when the quality gate detects weak fields",
    )
    parser.add_argument(
        "--accept-partial",
        action="store_true",
        help="Diagnostic/smoke mode: keep exit code 0 for PARTIAL while the report still records PARTIAL",
    )
    args = parser.parse_args()
    threshold = min(1.0, max(0.0, args.browser_threshold))
    enrichment_limit = max(0, args.browser_enrichment_limit)
    limit = max(0, args.limit)
    if args.url:
        temp = store_from_url(args.url, args.slug)
        outcome, products = asyncio.run(
            crawl(
                temp["slug"],
                limit,
                browser_threshold=threshold,
                browser_enrichment_limit=enrichment_limit,
                store_url=args.url,
            )
        )
    else:
        outcome, products = asyncio.run(
            crawl(
                args.store,
                limit,
                browser_threshold=threshold,
                browser_enrichment_limit=enrichment_limit,
            )
        )

    if products == 0:
        raise SystemExit(4)
    if outcome == "PARTIAL" and not args.accept_partial:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
