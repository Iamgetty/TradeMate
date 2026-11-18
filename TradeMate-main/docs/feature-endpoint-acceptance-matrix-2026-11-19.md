# TradeMate feature-to-endpoint acceptance matrix

Audit branch: `fix/audit-remediation-2026-11-18`  
Audit date: 2026-11-19  
Scope: source-level route inventory and known CI evidence. This is not a claim of live-provider or production acceptance.

## Server-backed feature inventory

| Feature | Server boundary found in source | Current verification evidence | Remaining acceptance work |
|---|---|---|---|
| Authentication and account security | NestJS `/api/auth/*`: registration, email verification, login, profile, password reset/change, 2FA, sessions, account deletion, logout | API build/security tests; browser app-shell suite; database integration includes authentication audit atomicity/rollback | Complete real two-account registration, verification, login/logout, password reset, 2FA and session-revocation browser journeys against disposable services |
| Preferences and notifications | NestJS `/api/preferences`, `/api/notifications` | API/database CI and source validation | Verify persistence, unread counts, read-all, per-item read and account isolation in browser |
| Support and feedback | NestJS `/api/support/tickets`, ticket messages and feedback | Routes and validation schemas exist | Verify ticket create/reply/read, ownership/moderation and durable feedback submission |
| Organizations and documents | NestJS `/api/organizations` | Database integration verifies document permissions and rollback through HTTP endpoints | Browser acceptance for organization membership, document upload/download, role changes and cross-tenant isolation |
| Marketplace listings / B2B inventory | NestJS `/api/market/listings` | Database integration exercises marketplace schema; API builds pass | Verify listing create/edit/submit/publish/review, inventory and seller/buyer permissions through browser |
| Marketplace enquiries and messages | NestJS `/api/market/enquiries` | Routes and database schema are present | Verify enquiry/reply persistence, notification delivery and participant-only message access |
| Contracts / deal room | NestJS `/api/market/contracts` | Latest CI passes two-party contract lifecycle and concurrency integration; browser acceptance job passed | Record exact browser scenarios and verify refresh/re-entry, messages, cancellation, completion and audit trail |
| P2P marketplace | NestJS `/api/p2p` | Latest CI passes P2P lifecycle, privacy and concurrency integration | Browser acceptance for ad/order/payment-sent/receipt/cancel/dispute, precision, ownership and race handling |
| Community feed and profiles/follows | NestJS `/api/feed/*`, `/api/profiles/*` | API/database integration and builds; feed and profile routes are server-backed | Verify post/media/comment/reaction/report/moderation and follow/unfollow across two real test accounts |
| Forex reference quotes | NestJS `/api/market/quotes` | Route and validation schema exist; provider acceptance is not established by build tests | Validate provider response, symbol mapping, freshness, failure/stale state and browser rendering |
| Crypto spot / exchange feed | WebSocket `/api/market-feed`; exchange-feed service connects to external venues | Latest CI passes exchange-feed and MT5 tests plus Workers compatibility; this is market-data plumbing, not custody/trading | Verify live venue availability, reconnect/freshness, symbol mapping, stale-state clearing and cross-region latency |
| NFT discovery | Next.js server routes `/api/nfts`, `/api/nft-collections`, `/api/nft-collection`; OpenSea key stays server-side | Web build and Cloudflare isolated build pass; three new route-level browser tests cover unconfigured-provider handling and abort signals for search, collection discovery and enrichment requests. All OpenSea fetches in these routes now have an 8-second abort timeout; latest commit CI is still pending. | Verify OpenSea credentials, provider rate limits, timeout behaviour and empty/error states in the deployed environment |
| Marketplace category highlights | Express route `/api/market/highlights`, registered by `attachMarketHighlights()` | Route implementation and UI consumer found; no dedicated route-level test was located in this audit | Add deterministic tests for invalid division, no DB, empty results, aggregate queries, cache expiry and DB/provider failure |

## Explicitly incomplete / not a real-money workflow

These screens or capabilities must not be treated as fully operational merely because a UI exists:

- KYC submission: no active KYC provider-backed submission workflow identified.
- Crypto and fiat deposits: no production deposit-address/fiat funding and crediting workflow identified.
- Transfers and withdrawals: no complete real-money withdrawal/transfer workflow identified.
- Wallet funding/balances: not a funded custody ledger.
- B2B subaccounts: local UI state only.
- Google/Telegram/X linking: not verified as completed OAuth account linking.
- Referral rewards and promotions: no verified attribution/reward ledger.
- Advertising requests: local success state is not proof of a persisted server submission.
- TradeMate Card and fee rates: not configured as a live card/fee product.
- Portfolio Manager sample figures and Contract Scout synthetic sparklines: must not be represented as real balances or a suitability recommendation.

## Verification boundaries

1. A route, page, successful build or mocked browser test proves source/build behaviour only; it does not prove production configuration, external-provider credentials, live data quality or real-money settlement.
2. The latest branch CI run `44424268198` passed all eight jobs, including disposable PostgreSQL integration and two-account browser acceptance. Keep that evidence attached to this branch commit only.
3. Production database RLS/least-privilege rollout, Render live environment verification, OpenSea credentials, live market-provider acceptance, desktop/mobile device QA and production security testing remain separate gates.
4. Do not enable deposits, withdrawals, custody, OAuth providers or external integrations based on this inventory. Each needs its own provider, security, reconciliation, audit and acceptance design.
