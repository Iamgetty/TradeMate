# Production data integrity contract

**Status:** engineering baseline for production behaviour. This document distinguishes production data from test fixtures and presentation-only metadata.

## Non-negotiable rules

1. **No synthetic business records in production.** Never create sample users, organizations, listings, enquiries, contracts, orders, balances, reviews, messages or activity to make a screen look populated. Production records must originate from an authenticated user action, a verified external provider, or an explicitly documented operational import.
2. **No fabricated market values.** Never substitute hard-coded, interpolated, randomly generated, stale-by-default or cross-instrument prices for a missing provider quote. A missing quote is `null` and is rendered as unavailable.
3. **No false success.** A write is successful only after the authoritative API/database operation commits. Optimistic UI may be used only when it can be rolled back and must not imply durable completion before acknowledgement.
4. **No silent provider failure.** Provider timeouts, invalid payloads, rate limits and disconnections must produce structured diagnostics and an explicit unavailable/degraded state. Do not silently retain a value while labelling it live.
5. **No hidden local-mode production fallback.** Local/demo mode is for isolated development only. Production must fail closed if its API/session/database configuration is missing; it must never silently switch to browser-local persistence.
6. **Test data stays isolated.** Fixtures, mock APIs, fake clocks, fake sockets and seeded test accounts are allowed only in deterministic tests or disposable non-production environments. They must never use production credentials, production databases, production service URLs or production user records.
7. **Provenance follows the value.** Every externally sourced quote must retain provider/source, instrument identifier, currency/unit, provider market timestamp, server receipt timestamp, and freshness classification. Cached snapshots must additionally retain snapshot time and original market time.
8. **No misleading cache fallback.** Cached values must be visibly labelled as snapshots with their age and original timestamp. Expired values must not be displayed as current prices. Cache age limits are asset-class-specific and require an explicit rationale.
9. **Real empty states are valid.** Empty, unavailable, delayed and degraded are legitimate product states. Do not add invented content to avoid an empty screen.
10. **Auditability.** Material writes must retain actor, target, timestamp, outcome and correlation/request identifier where appropriate. Logs must not contain passwords, session tokens, provider secrets or sensitive personal data.

## Data-source ownership

| Domain | Authoritative source | Required behaviour when unavailable |
|---|---|---|
| Accounts, profiles, organizations and memberships | PostgreSQL through authenticated API | Show load/error state; do not create local shadow records |
| Listings, enquiries, conversations and contracts | PostgreSQL through authenticated API | Show empty/error/retry state; never synthesize business activity |
| P2P offers/orders and any future balances | Durable backend state and approved provider integrations | No simulated balances, fills, transfers, escrow or settlement |
| Crypto spot/derivatives market data | Exchange-feed service, with source/exchange and market type retained | Mark stale/unavailable; never replace with a different market or fabricated value |
| FX and macro instruments | Explicitly approved quote provider per instrument | Preserve indicative/delayed classification; no implication of executable broker pricing |
| NFT discovery | Configured marketplace/indexer provider | Show provider-not-configured, unavailable or genuinely empty state |

A provider response is not automatically trustworthy: validate schema, symbol, units, currency, timestamp, positive/finite values, and provider-specific market semantics before accepting it.

## Test and release boundaries

- Browser tests that stub APIs are regression tests, not proof of live acceptance.
- PostgreSQL integration tests must use disposable databases and fixture records created by test setup, then clean them up.
- Live two-account acceptance must use dedicated non-production accounts and a disposable or explicitly isolated environment. Never seed the production database to make an acceptance test pass.
- CI must fail if production build configuration enables mock handlers, fixture injection, local persistence fallback or test-only provider overrides.
- Production release evidence must identify commit, service/deployment, migration result, health/readiness result, provider freshness and smoke-test outcome.
- A health endpoint proves process/database reachability only to the extent it checks those dependencies. It does not prove market-data freshness or feature acceptance.

## Initial audit findings — 15 November 2026

These are source-level observations, not claims that all user journeys have been accepted in production:

- The market catalogue initializes instrument prices as `null`; that is the correct fail-closed default rather than a made-up price.
- The browser runtime contains a local mode when `TM_CONFIG.api` is absent. Production configuration must be verified to ensure the deployed runtime always receives the same-origin API configuration and cannot silently enter local mode.
- The crypto market refresh currently calls CoinGecko directly from the browser and catches failures without surfacing a per-instrument provider error. This is a provenance/observability gap and a competing quote-source path that needs to be reconciled with the exchange-feed source of truth before changing it.
- FX reference rates can be restored from a local snapshot for up to 14 days. The UI labels these as snapshots; the age limit and suitability for each FX instrument still need product/data review.
- Index, commodity, equity and bond quote snapshots can be restored for up to 30 days. Although labelled as snapshots, this is too broad to accept without asset-class-specific freshness rules.
- Forex/index/commodity/equity/bond provider quotes are fetched server-side from Yahoo Finance and returned with live/delayed/unavailable status. Provider terms, uptime, timestamp semantics and suitability must be reviewed; do not imply executable pricing.
- The exchange-feed service exposes separate readiness diagnostics and uses stale-book filtering. Its production feed logs show repeated provider reconnects; readiness/freshness must be checked directly, not inferred from successful process startup.
- Mocked Playwright tests and real PostgreSQL-backed two-account acceptance tests both exist. Their evidence must remain clearly separated; test fixtures are not production data.

## Execution order

1. Verify production web/API/feed configuration and confirm production cannot enter local/mock mode.
2. Define per-asset-class provider ownership and quote freshness policy; eliminate ambiguous competing quote writers.
3. Add end-to-end quote provenance, timestamp and stale/unavailable tests, including provider silence and malformed responses.
4. Reduce cached quote lifetimes to justified per-asset-class limits and ensure expired snapshots cannot appear current.
5. Audit all business-data screens for local/demo fixtures, optimistic success, seeded records and fallback content.
6. Verify persistent writes and two-account permissions against an isolated live-like environment.
7. Record deployment, health, readiness, provider freshness and smoke-test evidence for all three services.

No production database seeding, provider switch, cache invalidation, credential change or production RLS activation is authorized by this document.
