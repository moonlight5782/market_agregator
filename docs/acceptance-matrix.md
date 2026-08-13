# Catalog Acceptance Matrix

This matrix defines the minimum release evidence for the Moldova catalog service. A successful process is not sufficient on its own: each verified source must demonstrate meaningful data, acceptable freshness, and predictable behavior under catalogue growth.

| Scenario | Representative coverage | Required evidence | Release threshold |
|---|---|---|---|
| Store connector diversity | A dedicated connector, a generic HTML/API connector, a browser-assisted connector, and a blocked/unsupported source | Fixture-based tests plus a controlled live smoke run where the source permits it | Each permitted source is either accepted with a source report or marked unavailable without publishing data |
| Product-category diversity | Electronics, food, construction/home improvement, and beauty/home product examples | Parsed title, price, currency, external URL, category, and correct identity keys/variants | No required field may be silently fabricated; missing quantity remains `UNKNOWN` |
| Product identity | Same product represented by EAN, MPN/SKU, equivalent normalized title, and deliberately conflicting variants | Match decision with method, confidence, and review status | Exact identifiers may auto-match; ambiguous variants must remain reviewable and separate |
| Branch and stock | One online-only offer, one branch-specific available offer, one low-stock record, one out-of-stock record, and one source without quantity | Correct branch/address coordinates and availability provenance | UI/API returns `lastSeenAt`, source timestamp, and an explicit unknown/online-only state |
| Freshness | New, ageing, stale, and failed-source records | Freshness timestamp and source health transition | Stale offers are excluded from active comparison; health report makes the reason visible |
| Large catalog | Synthetic mixed catalog with 10,000 products, 50,000 offers, and 100,000 availability snapshots | Deterministic load report, bounded concurrency, and memory/time measurements | Import, search, and health calculation remain bounded; failures are isolated and replayable |
| Failure isolation | Timeout, malformed payload, partial import, and no eligible stores | Structured outcome and non-zero status where appropriate | No source failure may silently publish incomplete or stale data as current |

## Interpretation

A store becomes `VERIFIED` only after it meets the coverage, data-quality, and freshness evidence defined above. A store with insufficient evidence remains `UNVERIFIED`, `PARTIAL`, or `BLOCKED`; it must not be automatically included in the production synchronization set.

For live source testing, public pages and documented feeds are used only within the source's allowed access policy. The crawler must record whether its request was allowed, blocked, or rate-limited and must not circumvent access controls.
