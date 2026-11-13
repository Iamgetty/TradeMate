# Backend module boundary audit

## Baseline

Audited against `main` at the time of this inventory. The NestJS API currently concentrates its HTTP controllers and most domain persistence logic in `apps/api/src/module.ts`.

- `module.ts`: 3,228 lines.
- 15 controllers and 91 route decorators.
- The first 144 lines contain shared infrastructure and security helpers before the first controller.
- The module imports Nest decorators, Node crypto, PostgreSQL pool types and request/response types in one file.
- Controllers generally issue SQL directly through a shared PostgreSQL pool rather than delegating to domain services/repositories.
- `main.ts` creates the Nest application, installs JSON parsing and database request context middleware, configures CORS, attaches the market feed and sets the `api` prefix.

This is an inventory only. No route, SQL, permission, transaction, schema, middleware or runtime behaviour was changed by this audit.

## Controller inventory

| Domain | Controller | Current source range | Route operations |
|---|---|---:|---|
| Health | `HealthController` | 145–165 | health, database health |
| Identity and authentication | `AuthController` | 166–878 | registration, email verification, login, session, profile, password reset/change, TOTP, account deletion, logout |
| Preferences | `PreferencesController` | 879–949 | read/update preferences |
| Notifications | `NotificationsController` | 950–1003 | list, mark read, mark all read |
| Customer support | `SupportController` | 1004–1163 | tickets, ticket messages, feedback |
| Organizations | `OrganizationsController` | 1164–1340 | organization membership, create/update, documents |
| Marketplace listings | `PublicListingsController` | 1341–1701 | create, mine, submit, update, delete, detail, browse |
| Marketplace enquiries | `EnquiriesController` | 1702–1907 | create, list, enquiry messages |
| Contracts | `MarketplaceContractsController` | 1908–2310 | create, list, detail, respond, cancel, completion, messages |
| Market activity | `MarketplaceTradesController` | 2311–2386 | activity and trade listing |
| P2P | `P2PMarketController` | 2387–2566 | public book/trades, ads, orders, payment status, cancellation, disputes |
| Public profiles | `PublicProfilesController` | 2567–2705 | profile read/update and follows |
| Community feed | `CommunityFeedController` | 2706–3027 | posts, attachments, comments, reactions, pins, reshares, reports, feed moderation and announcements |
| Moderation | `ModerationController` | 3028–3174 | organization and listing review |
| Market data | `PublicMarketQuotesController` | 3175–3221 | quote retrieval |

Line ranges are a baseline locator, not stable identifiers; update this inventory as extraction moves code.

## Shared infrastructure and security-sensitive helpers

The pre-controller section currently owns several concerns that must be deliberately separated before controller extraction:

- Password hashing and password comparison using scrypt.
- TOTP secret encryption/decryption, Base32 encoding/decoding and TOTP verification.
- One-time token hashing/digests.
- Transactional email delivery.
- Session cookie configuration and session-token extraction.
- Shared PostgreSQL pool creation and lifecycle.
- TOTP action rate limiting.

These helpers are not interchangeable generic utilities. Their configuration, error semantics, timing behaviour, key handling and test coverage must remain explicit. In particular, do not duplicate password/TOTP/token implementations across modules during a refactor.

## Main coupling risks

1. **Shared database pool and request context.** SQL currently executes directly from controllers. Any repository/service extraction must preserve the transaction client, request-local user identity and connection-pool isolation semantics tested by the database integration suite.
2. **Authentication/session coupling.** Many controllers independently resolve the session cookie and user identity. A shared guard/decorator or auth service must preserve endpoint-by-endpoint public/private access and existing HTTP status behaviour.
3. **Audit atomicity.** Organization, listing, contract, P2P, feed and moderation mutations have audit/transaction expectations. Moving code must not split business writes from audit writes or change rollback boundaries.
4. **Contract workflow boundaries.** Services and B2B are the only currently persistent contract workflows. Other marketplace divisions must not be activated as contract types as a side effect of module extraction.
5. **P2P is not escrow.** Existing P2P order/payment/dispute endpoints do not imply held funds or escrow. Preserve the current lifecycle and do not add payment custody during a structural refactor.
6. **Feed and file access.** Feed attachment reads/writes and organization document access have distinct authorization and size/content rules. Avoid generic file handlers that weaken those boundaries.
7. **Runtime bootstrap.** Database request context middleware and WebSocket market-feed attachment are installed in `main.ts`; module extraction must not move or reorder these implicitly.

## Recommended extraction sequence

This is a proposed low-risk order, not permission to change product behaviour:

1. Establish shared infrastructure modules/providers for database lifecycle, request context access, session identity and cryptographic helpers, with tests proving unchanged semantics.
2. Extract Health, Preferences, Notifications and Support as small vertical modules.
3. Extract Organizations with its document authorization and transactional audit tests.
4. Extract marketplace Listings, Enquiries and Contracts separately; preserve Services/B2B contract gates and all concurrency tests.
5. Extract Market activity and quote retrieval.
6. Extract P2P as its own module only after its lifecycle/audit/precision test gaps are covered.
7. Extract Profiles and Feed, keeping attachment access and moderation permissions explicit.
8. Extract Moderation workflows.
9. Refactor Auth last, after shared identity/crypto/session contracts are stable; it has the largest security-sensitive surface.

Prefer one domain per pull request. Keep route paths, DTO validation, status codes, SQL semantics, transaction boundaries, audit event contents and response shapes unchanged unless a separately reviewed behaviour change is intended.

## Required checks for each extraction

- API TypeScript build and all API security tests.
- Full clean-database migration/integration suite.
- Existing route-by-route contract tests and frontend API compatibility.
- Authenticated two-account isolation and permission-denial cases where relevant.
- Transaction rollback and audit atomicity for every mutation moved.
- Concurrency/row-lock tests for listings, contracts and P2P lifecycle operations.
- Feed/WebSocket and attachment/document authorization tests where relevant.
- No production migration, live data mutation or deployment as part of structural extraction without explicit approval.

## Known gaps to address before broad extraction

- Add dedicated P2P lifecycle integration coverage for every state transition, dispute review/resolution and audit event.
- Review numeric money handling end-to-end; do not introduce JavaScript floating-point arithmetic into financial calculations.
- Map current route-level authentication/authorization requirements into an explicit access matrix before introducing shared guards.
- Establish a route/response contract snapshot so moving controllers cannot silently change frontend-facing behaviour.
- Preserve the existing least-privilege database role, RLS owner isolation, FORCE RLS and transaction-local identity integration checks.
