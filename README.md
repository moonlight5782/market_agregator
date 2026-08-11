# Moldova Commerce

Data-first MVP of a Moldovan retail aggregator.

## MVP goal

Build the most complete practical index of Moldovan retail products with normalized categories, correct prices, stock/quantity when the merchant exposes it, physical store locations, freshness timestamps and outbound links to merchants.

Checkout is external in MVP. The domain already contains `CheckoutType.EXTERNAL | PLATFORM` so connected marketplace checkout can be introduced later without replacing Product/Offer/Store.

## Architecture

- Next.js / TypeScript: web + server modules
- PostgreSQL / Prisma: source of truth
- PostGIS: planned geo queries
- Redis: queue/cache
- OpenSearch: scalable search read model
- Python: acquisition, normalization and matching workers

Data pipeline:

`StoreSource -> Connector -> RawProduct -> Normalizer -> CategoryMapper -> ProductMatcher -> Product/Offer -> Search`

## Run locally

1. `cp .env.example .env`
2. `docker compose up -d`
3. `npm install`
4. `npm run db:generate`
5. `npm run db:push`
6. `npm run dev`

Scraper environment:

1. `python -m venv .venv`
2. activate it
3. `pip install -r services/scraper/requirements.txt`

## Non-negotiable data rules

- Never invent quantity when a store only says "in stock".
- Keep store taxonomy separate from canonical taxonomy.
- Keep Product separate from Offer.
- Prefer EAN/GTIN, MPN and SKU over fuzzy title matching.
- Low-confidence matches go to manual review.
- Never delete historical prices merely because an offer disappears.
- Store-specific acquisition logic stays inside connectors.
- Respect site access restrictions; do not bypass CAPTCHA or anti-bot controls.

## Next implementation milestones

1. Store registry + verified Moldovan store discovery.
2. Generic sitemap/HTML acquisition connectors.
3. First real store connector and end-to-end import.
4. Category mapper and persistence pipeline.
5. Search/results/product pages.
6. Store locations and radius filtering.
7. Data-quality/admin dashboard.
