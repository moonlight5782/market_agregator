# Production deployment and rollback

This branch is a **reversible stabilization candidate**. It keeps `main` unchanged and is based on the protected rollback tag `pre-stabilization-2efa730`. The current stabilization branch is `agent/stabilize-production-readiness`.

## What is ready

The release candidate contains bounded multi-store crawling, fail-safe robots enforcement, strict raw-record validation, product-service filtering, database-backed freshness and location query controls, safer reconciliation of missing offers, catalog-route prioritization, and a guarded verified-store batch runner. The application also has a production build, a reproducible dependency lock, and no high-severity production advisories at the time of validation.

A crawl is not publish-ready merely because it returned products. The importer and report require complete price, category, identity, and stock quality, together with verified catalog coverage. Bounded samples intentionally remain `PARTIAL`; they are diagnostic evidence, not a substitute for a full merchant synchronization.

## Scheduled execution options

| Approach | Tradeoffs | Cost | Setup complexity |
|---|---|---:|---|
| Run the provided systemd timer on an existing Linux machine | Uses the current Node and Python crawler without a rewrite. The machine must remain online and have PostgreSQL, browser dependencies, and the required environment variables. | No new hosting cost if the machine already exists | Moderate |
| Run the worker on a managed persistent application host | Removes local administration and can keep the web service and worker online continuously. The host must support the repository’s Python/browser dependencies and PostgreSQL connectivity. | Provider-dependent; free tiers may not support the crawler workload | Moderate to high |

The repository includes the first option under `ops/systemd/`. The timer runs twice daily at 02:30 and 14:30 in the host timezone, adds a random delay of up to 15 minutes, uses concurrency 1 by default, and fails rather than reporting success when the registry has no eligible verified stores.

## Linux installation

Copy the repository to `/opt/market_agregator`, install Node.js, Python, the crawler browser dependencies, and PostgreSQL connectivity, then install production dependencies with `npm ci`. Create a dedicated `market-agregator` operating-system user with write access to `data/raw` and `data/reports`.

Create `/etc/market-agregator/market-agregator.env` from `.env.example`. At minimum, set a real `DATABASE_URL`, a strong `AUTH_SECRET`, and a separate `LOYALTY_CARD_ENCRYPTION_KEY_V1`. Do not commit this file or put credentials in the repository. Run `npm run db:generate` and apply the Prisma migrations using the project’s normal database deployment process before enabling synchronization.

Install the units as root:

```bash
install -d -m 0750 /etc/market-agregator
install -m 0644 ops/systemd/market-agregator-sync.service /etc/systemd/system/
install -m 0644 ops/systemd/market-agregator-sync.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now market-agregator-sync.timer
systemctl start market-agregator-sync.service
systemctl status market-agregator-sync.timer
journalctl -u market-agregator-sync.service -n 200 --no-pager
```

Before enabling the timer, the registry must contain stores with `status: "VERIFIED"`. The current repository registry intentionally has zero verified stores, so a manual run correctly exits non-zero with a diagnostic summary instead of silently doing no work. Do not broaden the timer to `DISCOVERED` or `UNVERIFIED` until each merchant has been reviewed for robots permission, parser quality, branch mapping, and freshness.

## Freshness and scale policy

The user-facing catalog applies the configured `OFFER_MAX_AGE_HOURS` cutoff. A successful uncapped crawl reconciles offers that were absent from that run using a bounded grace window; incomplete or bounded diagnostic runs do not mark missing products out of stock. Fresh-offer indexes, branch-availability indexes, and coordinate indexes support the main filter paths. Radius filtering first applies a database bounding box and then performs exact distance checks.

The batch runner uses bounded concurrency and per-store crawl limits. It records successes, partials, and failures independently. A partial store does not become a successful store, and the process returns exit code 2 so a scheduler can alert without treating a useful diagnostic result as a clean production refresh.

## Rollback

The immutable rollback point is the Git tag `pre-stabilization-2efa730`, which also exists as the remote branch `backup/pre-stabilization-2efa730`. To roll back code, stop the timer, switch to the tag or restore the backup branch, reinstall the matching lockfile, and rebuild:

```bash
systemctl disable --now market-agregator-sync.timer
cd /opt/market_agregator
git fetch origin --tags
git checkout pre-stabilization-2efa730
npm ci
npm run db:generate
npm run build
systemctl enable --now market-agregator-sync.timer
```

Database migrations must be rolled back only with a reviewed, backward-compatible migration plan. The code rollback tag is not a substitute for restoring database data. Before a production cutover, take a database backup and test both the application rollback and the data-restore procedure in a staging environment.
