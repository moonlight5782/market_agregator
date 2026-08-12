# Moldova Commerce

Data-first MVP of a Moldovan retail aggregator.

## MVP goal

Build the most complete practical index of Moldovan retail products with normalized categories, correct prices, stock/quantity when the merchant exposes it, physical store locations, freshness timestamps and outbound links to merchants.

Checkout is external in MVP. The domain already contains `CheckoutType.EXTERNAL | PLATFORM` so connected marketplace checkout can be introduced later without replacing Product/Offer/Store.

## Architecture

- Next.js / TypeScript: responsive web UI + server modules
- PostgreSQL / Prisma: source of truth
- Python/httpx/BeautifulSoup/Playwright: adaptive acquisition
- Redis/OpenSearch: planned/optional for scale; not required for the first MVP

Data pipeline:

`Store -> Source Discovery -> prioritized connectors -> RawProduct -> Normalizer -> CategoryMapper -> ProductMatcher -> Product/Offer -> Next.js`

Acquisition priority:

1. Public API / JSON / GraphQL hints
2. Catalog feeds (JSON/XML/CSV/YML)
3. Sitemap + JSON-LD / embedded structured data
4. Store-specific public catalog discovery where needed
5. Generic HTML parser
6. Browser-rendered Playwright fallback only when earlier methods do not reach the configured coverage threshold

Current store-specific discovery exists for Darwin, Maximum and Cactus. SUPRATEN is covered by robots.txt sitemaps plus generic HTML extraction, including numeric availability and article/SKU when exposed.

## Demo preview without a database

`npm install`

`npm run dev:replit`

`DEMO_MODE=true` is used by the Replit preview command. Demo data is intentionally separate from production data.

## Production/dev database setup

1. Configure `DATABASE_URL`.
2. `npm install`
3. `npm run db:generate`
4. `npm run db:push`
5. `npm run db:seed`
6. install scraper dependencies: `pip install -r services/scraper/requirements.txt`
7. start the app: `npm run dev` (or `npm run build && npm start`)

`db:seed` creates categories and stores only. Sample products are opt-in with `SEED_SAMPLE_PRODUCTS=true`; production must not use sample snapshots as fresh merchant data.

## Crawl and import real store data

One command runs acquisition and then imports the generated NDJSON into PostgreSQL:

`npm run data:sync -- --store=darwin --limit=500`

Other examples:

`npm run data:sync -- --store=maximum --limit=500`

`npm run data:sync -- --store=cactus --limit=500`

`npm run data:sync -- --store=supraten --limit=500`

Per-run acquisition reports are written to `data/reports/<store>.json`. Reports include strategy-level checked/accepted/duplicate/error counts and completeness for price, stock, image, category and identity.

## Freshness and stock rules

- Real UI only shows offers seen within `OFFER_MAX_AGE_HOURS` (default 48 hours).
- Never invent quantity when a store only says “in stock”.
- Persist numeric quantity when a merchant exposes it.
- UI shows exact quantity only for 1–10 units; 11+ is displayed as “In stock”.
- Quantity 0 means out of stock.
- Repeated imports update `lastSeenAt`; price/stock timestamps change only when those values change.

## Non-negotiable data rules

- Keep store taxonomy separate from canonical taxonomy.
- Keep Product separate from Offer.
- Prefer EAN/GTIN, MPN and SKU over title matching.
- Do not aggressively merge similar but different products.
- Never delete historical prices merely because an offer disappears.
- Store-specific acquisition logic stays inside connectors.
- Prefer structured public interfaces to HTML/browser scraping.
- Respect robots/site access restrictions and rate limits; do not bypass CAPTCHA or anti-bot controls.

## CI

GitHub Actions validates Prisma, TypeScript and Python compilation and runs scraper unit tests. New parser/connector behavior should get a fixture or unit test where practical.

## Next implementation milestones

1. Run real coverage tests for Darwin / Maximum / Cactus / SUPRATEN and fix parsing gaps.
2. Add more Moldovan stores across groceries, construction, furniture, beauty and fashion.
3. Expand canonical category mappings and matching tests.
4. Add physical store locations and city/radius filtering.
5. Add scheduled store sync workers on a Linux server/cloud environment.
6. Add data-quality/admin dashboard and stale-source alerts.
