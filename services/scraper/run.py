from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from .category_mapper import map_category
from .connectors.base import ConnectorContext
from .connectors.jsonld import SitemapJsonLdConnector
from .normalizer import normalize

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
    connector = SitemapJsonLdConnector(
        ConnectorContext(store_slug=store_slug, base_url=store["domain"], requests_per_second=1.0)
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / f"{store_slug}.ndjson"
    urls_seen = 0
    products_written = 0

    with output.open("w", encoding="utf-8") as fh:
        async for url in connector.discover_product_urls():
            if urls_seen >= limit:
                break
            urls_seen += 1
            try:
                raw = await connector.fetch_product(url)
            except Exception as exc:
                print(f"[WARN] {url}: {exc}")
                continue
            if raw is None:
                continue
            category_slug, category_confidence = map_category(raw.category_path, raw.title)
            item = normalize(raw, category_slug=category_slug)
            payload = item.model_dump(mode="json")
            payload["category_confidence"] = category_confidence
            fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
            products_written += 1
            print(f"[{products_written}] {item.title} — {item.price} {item.currency} — {category_slug or 'unmapped'}")

    print(f"Done. Checked {urls_seen} URLs, wrote {products_written} products to {output}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl one registry store using generic sitemap + JSON-LD discovery")
    parser.add_argument("--store", required=True, help="Store slug from data/store-registry.json")
    parser.add_argument("--limit", type=int, default=100, help="Maximum product URLs to inspect")
    args = parser.parse_args()
    asyncio.run(crawl(args.store, max(1, args.limit)))


if __name__ == "__main__":
    main()
