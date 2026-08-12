from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from .category_mapper import map_category
from .connectors.base import ConnectorContext
from .connectors.registry import build_connector_plan
from .normalizer import normalize
from .source_discovery import discover_sources

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "data" / "store-registry.json"
OUT_DIR = ROOT / "data" / "raw"


def load_store(slug: str) -> dict:
    stores = json.loads(REGISTRY.read_text(encoding="utf-8"))
    for store in stores:
        if store["slug"] == slug:
            return store
    raise SystemExit(f"Store '{slug}' not found in registry")


async def crawl(store_slug: str, limit: int) -> None:
    store = load_store(store_slug)
    context = ConnectorContext(store_slug=store_slug, base_url=store["domain"], requests_per_second=1.0)
    profile = await discover_sources(store["domain"], timeout_seconds=context.timeout_seconds)
    plan = build_connector_plan(context, profile)

    print(
        f"[DISCOVERY] {store_slug}: strategies={[x.name for x in plan]}; "
        f"sitemaps={len(profile.sitemap_urls)}; jsonld={profile.product_jsonld}; "
        f"embedded_json={profile.embedded_json}; html_hints={profile.html_product_hints}; "
        f"api_hints={len(profile.api_hints)}; blocked={profile.blocked}"
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / f"{store_slug}.ndjson"
    seen_products: set[str] = set()
    products_written = 0
    strategy_stats: list[tuple[str, int, int]] = []

    with output.open("w", encoding="utf-8") as fh:
        for choice in plan:
            urls_seen = 0
            accepted = 0
            print(f"[TRY] priority={choice.priority} connector={choice.name}: {choice.reason}")

            try:
                async for url in choice.connector.discover_product_urls():
                    if products_written >= limit:
                        break
                    urls_seen += 1
                    try:
                        raw = await choice.connector.fetch_product(url)
                    except Exception as exc:
                        print(f"[WARN:{choice.name}] {url}: {exc}")
                        continue
                    if raw is None:
                        continue

                    category_slug, category_confidence = map_category(raw.category_path, raw.title)
                    item = normalize(raw, category_slug=category_slug)
                    dedupe_key = item.ean or item.mpn or f"{item.store_slug}:{item.external_id or item.url}"
                    if dedupe_key in seen_products:
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
            except Exception as exc:
                print(f"[STRATEGY FAIL] {choice.name}: {exc}")

            strategy_stats.append((choice.name, urls_seen, accepted))
            print(f"[RESULT] {choice.name}: checked={urls_seen}, accepted={accepted}")

            if products_written >= limit:
                break

    stats = ", ".join(f"{name}:{accepted}/{checked}" for name, checked, accepted in strategy_stats)
    print(f"Done. Wrote {products_written} unique products to {output}. Strategies: {stats}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl one registry store using prioritized adaptive acquisition")
    parser.add_argument("--store", required=True, help="Store slug from data/store-registry.json")
    parser.add_argument("--limit", type=int, default=100, help="Maximum unique products to collect")
    args = parser.parse_args()
    asyncio.run(crawl(args.store, max(1, args.limit)))


if __name__ == "__main__":
    main()
