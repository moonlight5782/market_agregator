# Store coverage report format

Every real-store validation must publish one report with the following fields. A connector is not `VERIFIED` until `Catalog estimate` and `Collected` are both backed by a reproducible method.

```text
Store: <name>
Status: VERIFIED | PARTIAL | FAILED
Catalog estimate: <N>
Catalog estimate method: <how the reference count was obtained>
Collected: <N>
Coverage: <X%>
Price completeness: <X%>
Stock completeness: <X%>
Image completeness: <X%>
Category completeness: <X%>
Identity completeness: <X%>
Primary source: API | Feed | JSON-LD | HTML | Browser
Fallbacks used: <list>
Errors: <N>
Duration: <seconds>
Last verified: <ISO date>
GitHub commit: <SHA>
Report path: data/reports/<store>.json
```

## Verification rules

- `DONE` means the connector code exists and passes automated tests.
- `VERIFIED` means a real catalog run was compared to an independently reproducible catalog-size estimate.
- A run capped by `--limit` cannot establish full coverage unless the catalog estimate is less than or equal to that limit.
- If the reference catalog size is uncertain, use `PARTIAL` and document the estimation method and uncertainty.
- `Coverage = Collected / Catalog estimate * 100` after cross-strategy deduplication.
- Completeness metrics are calculated over the final unique collected products.
- Do not infer stock quantity when the merchant only exposes a boolean availability state.
- Do not infer a branch schedule from generic call-center or online-order hours. Store
  opening hours only when the source identifies the physical branch, and retain the
  source URL plus `checkedAt` timestamp.
- Publish the resulting numbers to the shared Notion `VERIFIED RESULTS` section and include the GitHub commit/report path.

## Normalized branch opening hours

Branch availability records may include `opening_hours`. All seven weekday keys must
be present; an empty array means the branch is closed that day, while a missing key
means the schedule is incomplete and the UI must show it as unknown.

```json
{
  "version": 1,
  "timezone": "Europe/Chisinau",
  "weekly": {
    "mon": [{ "open": "09:00", "close": "20:00" }],
    "tue": [{ "open": "09:00", "close": "20:00" }],
    "wed": [{ "open": "09:00", "close": "20:00" }],
    "thu": [{ "open": "09:00", "close": "20:00" }],
    "fri": [{ "open": "09:00", "close": "20:00" }],
    "sat": [{ "open": "10:00", "close": "18:00" }],
    "sun": []
  },
  "source": {
    "url": "https://merchant.example/shops",
    "checkedAt": "2026-08-14T00:00:00Z"
  }
}
```

Multiple intervals per day and overnight intervals such as `22:00–02:00` are
supported. Use `{ "version": 1, "kind": "online_only" }` only when the source
explicitly identifies the merchant as online-only.
