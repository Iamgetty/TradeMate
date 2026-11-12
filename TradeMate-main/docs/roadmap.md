# TradeMate roadmap

This roadmap records the current product direction. It is not a claim that each item is already implemented or deployed.

## Current product principles

- TradeMate connects counterparties; it is not a conventional exchange or product checkout.
- The core outcome is a mutually agreed business contract.
- Current marketplace categories include Services and B2B, alongside Real Estate, Software, NFTs and market-information sections.
- Product listings and product-cart commerce are out of scope for the current build. A dedicated product marketplace may be reconsidered in a future version, subject to a deliberate product decision. It must not silently reappear in the current app.
- Keep P2P separate from the current marketplace contract workflow.

## Current implementation snapshot

The following implementation is present in the merged application history and current production baseline to varying degrees. Deployment evidence and outstanding end-to-end verification are recorded separately below; code presence must not be treated as workflow acceptance.

- **Product removal:** current Product category, product-cart UI and conventional marketplace transaction writes have been removed. Migration `009` converts legacy Product listing records to the explicit B2B type; historical migration files remain unchanged for reproducible database history.
- **B2B:** API and database now use `b2b` as a distinct listing type rather than reusing `product`.
- **Contracts:** persistent Services/B2B proposals, seller acceptance/decline, buyer cancellation, contract messages and dual fulfilment confirmation are implemented in the initial API/UI flow. No payment, escrow or e-signature is included. End-to-end QA remains.
- **Feed:** required title, file attachments, voice-note recording, inline audio playback and image previews are implemented. Mobile-device and failure-state QA remains.
- **Public profiles:** migration `019` has been applied to the live database (Database migrations workflow run 44 passed). Authenticated profile read/update endpoints, follow/unfollow endpoints, follow/unfollow audit events and frontend persistence for bio, social links, profile/cover photos and highlights are implemented. Feed responses expose author IDs and profile links now resolve by stable user ID. CI verifies the API build, web build/runtime syntax and clean-database migrations. Live end-to-end verification across two accounts and photo object-storage migration remain outstanding.
- **Forex foundation:** ten instruments are defined in each of the four requested groups, with a public quote route and no OANDA credentials. Live provider availability still needs verification.
- **Clients/Alpha modes:** the user-facing modes are Clients and Alpha; both have a Contracts view, while enquiries remain a separate Conversations view. Internal Buyer/Seller role values remain unchanged for compatibility. Permission and full workflow QA remains.
- **Browser QA foundation:** a Playwright suite boots the Next.js `/app` route with API traffic stubbed. The logged-out landing, desktop redirect and 390px mobile shell tests passed in six-job CI run [42381890566](https://github.com/Iamgetty/TradeMate/actions/runs/42381890566) on commit `7d5730cc110c8b359006ed7ca74efcf94799916b`. The authenticated two-context contract lifecycle spec drives the real login and Clients/Alpha UI while a shared in-memory API fixture simulates two distinct accounts and contract state. The marketplace listing retry/failure-injection test now exercises an initial 503 followed by a successful server-backed Services listing response; the navigation selector, server-list filtering and quote-formatting defects found by this test were corrected. All six CI jobs, including the complete browser app-shell smoke suite, passed on exact PR #79 head `2940e1f115fbf914f003264768c11e92d01f996d` in run [42423414076](https://github.com/Iamgetty/TradeMate/actions/runs/42423414076). This remains mocked API/browser regression coverage, not a live-backend integration test; real API/database two-account acceptance and the other retry paths remain outstanding.
- **Documents:** no litepaper or white paper source files were found in the available TradeMate repositories. The future Product consideration is recorded here and in the README; the original documents are needed before updating them.

## Production-deployed marketplace additions — 5 November 2026

The following code changes are confirmed in the production web service deployment history through commit `db96ceabb21889a3fcd87d1fffdc8abcfee06f15` (PR #77). Deployment status was confirmed as `live`. This records deployment evidence, not a substitute for end-to-end user acceptance testing.

### Crypto marketplace
- Removed the **Crypto CFDs** marketplace filter/section; the marketplace is focused on spot instruments.
- Fixed the exchange-feed client so fresh spot ticker data from the exchange-feed service is forwarded to the marketplace as `marketQuotes`.
- Retained fresh-data filtering: stale or unavailable quotes are not fabricated or presented as live prices.
- Follow-up QA: verify that available spot instruments actually render, update, and show sensible empty/error states in both themes.

### Forex marketplace and MT5
- Added startup restoration of saved quote snapshots for Forex instruments beyond currency pairs, so saved prices can display while live quotes are loading or unavailable.
- Preserved the existing snapshot expiry rules and snapshot status indication.
- Added persistence/restoration of fresh Exness MT5 quotes and fallback to saved snapshots when the live feed is unavailable.
- Follow-up QA: verify each instrument group, snapshot age/expiry, feed recovery, and both themes under online/offline conditions.

### NFT marketplace
- Explore feed was changed to mix NFTs from the top 20 collections rather than limiting the display to one collection.
- Corrected the Explore selector handler so the top-20 feed is used when the view changes.
- Added timeout handling, independent request failure handling and partial-result rendering to prevent a stalled collection request from holding the entire Explore page in a loading state.
- Added cooldowns and reduced OpenSea request volume, including lighter Explore requests, to limit repeated failing requests and retry loops.
- Follow-up QA: verify actual mixed collection results, loading completion, collection navigation, network filtering and recovery from OpenSea/API failures. Preserve the established filter and button dimensions unless explicitly requested otherwise.

### Deployment evidence and release discipline
- PR #76 (Forex snapshot restoration) merged as `7fdbb006fa87ab0b041e3d7b8a452a2e91c85990`; its Render deployment completed successfully before being superseded by the later deployment.
- PR #77 (Crypto spot instrument visibility) merged as `db96ceabb21889a3fcd87d1fffdc8abcfee06f15`; Render deployment `dep-dbmdl2o473hc73e0hmd0` completed with status `live`.
- NFT improvements in PRs #71–#75 are included in the production deployment ancestry.
- For every subsequent change: run the relevant tests and security scans, inspect the final diff, obtain approval before merging, and verify Render reports `live`. A passing CI run alone does not mean production is updated.

## Pre-P2P completion register — reconciliation baseline

This register distinguishes source implementation from verified user workflows. A feature is not marked complete merely because a route or screen exists. The register is maintained against current `main`, with PR #16 as the historical integration milestone and PR #22 as a source-audit reference. PR #22 remains an unmerged draft and must not be merged as a stale branch.

| Workstream | Current assessment | Evidence / remaining gate |
|---|---|---|
| Product/cart removal and B2B terminology | **Implemented; audit outstanding** | PR #16 integrated the contract-first scope and current roadmap records Product/cart removal and B2B as a distinct listing type. Still audit every navigation, search, API and write path for legacy checkout/order/bid behaviour. |
| Services/B2B publishing and discovery | **Implemented in part; E2E unverified** | Current API/UI include organization-backed listing drafts, review submission and public discovery. Verify owner/admin permissions, moderation, edit/delete, empty/error states and two-account discovery in production. |
| Contract lifecycle | **Implemented in part; E2E unverified** | Proposal, seller response, buyer cancellation, messages and dual fulfilment confirmation are present. Verify every transition, unauthorized cross-account access, retries, concurrency and persistence with two real accounts. |
| Clients/Alpha modes | **Partially verified** | Both modes expose Contracts in the current product direction; internal Buyer/Seller roles remain for compatibility. Verify the same durable contract records and action permissions in both modes. |
| Feed titles, attachments and voice notes | **Validation aligned in PR #79; device QA outstanding** | Feed APIs support posts, attachments, comments and reports. PR #79 aligns API validation with the optional-title composer while retaining the body requirement and 140-character title limit. Test uploads, playback, downloads, limits and mobile permission/failure states. |
| Forex instruments and provider coverage | **Implemented in part; market QA outstanding** | Five groups and reference-quote routes exist; snapshot/MT5 restoration has production deployment evidence. Verify all instruments, freshness/expiry, offline restoration and feed recovery. |
| Application-wide QA | **Outstanding** | Audit all tabs, detail pages, forms, filters, responsive breakpoints, accessibility, authorization boundaries, performance and recoverable errors. |
| Litepaper / white paper | **Blocked on source documents** | No source documents were found in the available repository context. Do not invent or rewrite the original positioning without source material. |
| 5 November marketplace follow-up | **Deployed; acceptance testing outstanding** | Crypto spot, Forex/MT5 snapshots and NFT Explore reliability changes have deployment evidence. Complete the recorded production acceptance checks across all three themes and preserve the agreed NFT control dimensions. |

### PR #22 reconciliation against current main

PR #22 is an audit source, not an integration target. Its original branch is stale; reconcile findings individually and port only missing fixes onto a fresh branch.

- **Already present in current source:** organization profile-name update API and organization document ID validation. The earlier audit incorrectly described document uploads as transactional: PR #79 adds an explicit transaction with rollback and restricts verification-document upload/viewing to organization owners/admins. Regression coverage and two-role endpoint verification remain required.
- **Already present in current main (correction to the November 1 audit):** authenticated password change is implemented at `POST /auth/change-password`, with schema validation, current-password verification, session revocation and audit logging; the UI action is connected. The password inputs were not masked; this branch changes them to password inputs with appropriate autocomplete hints.
- **Feed mismatch confirmed on current main and corrected on this branch:** the composer treats the title as optional, while the API schema/controller required a non-empty title. The schema and controller now accept an omitted or empty title while retaining the 140-character maximum.
- **Session recovery changes on this branch:** logout sends its server-revocation request independently of account-scoped request cancellation, clears private local state immediately, and reports whether server revocation was confirmed. The API clears the browser cookie on the logout response; session deletion and the `auth.logout` audit event remain one atomic database transaction. If that transaction fails, the cookie is cleared but the server-side session row remains, and the UI explicitly reports that revocation was not confirmed. Session bootstrap clears the session only on HTTP 401 and preserves cached state on transient network/API failures with a visible warning.
- **Reliability fixes added in PR #79:** `loadMarket`, `loadMine`, `loadOrg`, `loadContracts`, `loadContractMessages`, `loadEnquiries` and `loadMsgs` now capture failures and expose retry/recovery UI in their affected screens. Verify the error and retry paths with API failure injection and mobile QA; do not mark complete until those tests pass.
- **Historical audit items requiring fresh verification:** account profile fields/photos, follow/highlight workflows, organization image upload, OAuth/account linking, password reset, KYC, wallet/ledger, support/feedback/notification paths, promotion/referral workflows, Real Estate/Software contract coverage and local-only preferences. Do not assume the November 1 audit remains current; several backend connections have since been added.

### Next execution order

1. **Exact-head CI and browser QA — CI gate passed; review and acceptance remain.** Exact PR #79 head `2940e1f115fbf914f003264768c11e92d01f996d` passed all six CI jobs in run [42423414076](https://github.com/Iamgetty/TradeMate/actions/runs/42423414076), including the marketplace listing retry/failure-injection browser test alongside desktop/mobile app-shell and the mocked two-account contract lifecycle test. PR #79 remains open and unmerged pending review and explicit approval. CI does not establish production deployment or live API/database end-to-end acceptance.
2. Services/B2B draft creation writes the listing and `listing.draft_created` audit event in one database transaction. The PostgreSQL-backed migration/integration job passed on exact PR #79 head `28bbded27ccd32af918419e5c89d6a8624562e48` in run `42224040295`; preserve this as CI evidence, while two-account publishing/moderation/discovery acceptance remains outstanding.
3. Current draft-creation policy permits any organization member (owner/admin/member) and denies unrelated accounts. This is the observed existing policy, not a new authorization decision. Product-owner confirmation is still needed before changing member publishing/submission permissions.
4. The organization lookup and listing-draft creation paths currently select the most recently created organization for a user. Multi-organization account behaviour is therefore not explicitly selectable in the current publishing flow; decide whether TradeMate supports multiple organizations per user and, if so, add explicit organization selection and authorization tests. Do not assume this is resolved by the single-organization flow.
5. Verify recoverable states/retry handling for market listings, organization/documents, own offers, contracts and enquiry conversations through browser failure-injection tests, without changing established marketplace/NFT layout dimensions. These UI recovery paths still need failure-injection and mobile acceptance evidence.
6. Run the complete Services/B2B and contract lifecycle two-account acceptance matrix, including publishing, moderation, public discovery, cross-account access and Clients/Alpha parity.
7. Complete Feed/mobile and Forex/Crypto/NFT production acceptance checks.
8. Continue the S1 security gates in parallel, without enabling production RLS until role/context/pool-reuse tests pass.
9. **Account, social and feed audit atomicity — CI verified on 7 November 2026:** TOTP enable/disable, session revocation, profile display-name and public-details updates, account preferences, feedback submissions, follow/unfollow, feed pin changes and feed announcements pair their state mutation with the audit insert in one transaction. Logout clears the browser cookie in the HTTP response even if the database transaction fails; the session-row deletion and audit insert themselves remain atomic, so a failed audit write leaves the server session row intact and the client reports revocation as unconfirmed. The PostgreSQL-backed HTTP integration test injects audit-trigger failures and verifies rollback plus successful paths for these operations; the complete five-job workflow, including database integration, API/web builds, exchange-feed/MT5 tests and SAST/SCA/secret scanning, also passed on the latest exact PR #79 head `854cadfc8e6e3bec01b2ad3983964784a24a1063` in run `42378223931`. This is CI verification, not deployed-production verification.

## Pre-P2P completion

1. Remove legacy Product UI, API paths and terminology; retain B2B as its own marketplace offer type.
2. Complete B2B and Services publishing, discovery, review and counterparty flows.
3. Complete end-to-end QA of the initial contract proposal, review, acceptance/rejection, cancellation and mutual fulfilment confirmation flow; extend it consistently across supported market categories and remove all remaining conventional buy/sell/order/bid checkout paths.
4. Make Clients mode and Alpha mode reflect the same durable contract records and permissions without changing internal role permissions or historical records.
5. Complete Feed post titles, file attachments and voice notes, including playback/download and mobile failure states.
6. Verify Forex market groups and public quote availability for the requested top-ten indices, commodities, equities and bonds/treasuries.
7. Audit every tab, detail view, form, filter, menu, responsive layout, authorization boundary and performance hotspot.
8. Update the litepaper and white paper once their source documents are available in the repository.
9. Complete the production verification tasks recorded under the 5 November 2026 marketplace additions above, including Crypto spot visibility, Forex/MT5 snapshot recovery and NFT Explore reliability, across both themes.

## Later-stage P2P

P2P work begins only after the pre-P2P requirements are verified and the product owner has supplied the remaining instructions. Any live crypto trading, escrow, custody or payment feature requires jurisdiction-specific legal/compliance review, provider approval, threat modelling and independent security testing.

## Future consideration: Product marketplace

A product marketplace is a possible future feature only. It is not part of the current scope and should not be included in current navigation, search, publishing, checkout or contract flows unless explicitly approved in a future product decision.

## Security, trust and compliance programme

This programme is part of the committed TradeMate roadmap. Every item below is planned work, not a claim of current implementation. Security work must be completed and verified in stages; do not enable database policies or financial controls in a way that locks out legitimate application workflows.

### Phase S1 — Secure development foundations

**Implementation status (2026-11-01): in progress.** The first code and process tranche is implemented and CI-verified:

- API TypeScript uses `strict: true`; API build passes with strict checks.
- Zod runtime schemas cover every current `@Body` request body, all current `@Query` inputs and UUID route parameters in the API module. Schemas reject unknown object keys and validate formats, limits, enumerations and numeric inputs. Critical startup environment values are also schema-validated before the API starts.
- API Zod schema tests cover authentication, TOTP, deletion, profiles, feed, support, organization documents, listings, enquiries, contracts, P2P, moderation, query filters and environment configuration.
- NIST SSDF policy: `docs/security/ssdf-policy.md`.
- PostgreSQL roles/RLS architecture: `docs/security/database-rls-design.md`. Least-privilege `trademate_app`, `trademate_migrator` and scoped `trademate_worker` bootstrap grants are implemented and passed on a clean PostgreSQL database in CI. The deletion worker uses its own production credential slot and no longer edits historical audit events. Transaction-local `app.session_token_hash` and DB-resolved `app.user_id` context is implemented and tested. Production roles have not yet been created or switched; RLS is not enabled.
- Pull-request security checklist: `.github/PULL_REQUEST_TEMPLATE.md`.
- CI security job runs Semgrep SAST, npm dependency audits for API/web/exchange-feed, and Gitleaks secret scanning. The high-severity audit threshold and all three scanners passed in CI run 41324646848.
- Next.js/React and NestJS/Zod dependency upgrades are applied. The API dependency tree still has lower-severity development-tool advisories below the current high-severity gate; these remain tracked for remediation.
- PostgreSQL TLS certificate verification is enabled for SSL connections. External Render DB migration workflow succeeded with verification enabled.
- AES-256-GCM TOTP encryption and decryption explicitly require a 16-byte authentication tag.
- Migration runner now prefers `MIGRATION_DATABASE_URL`, falling back to `DATABASE_URL` during the transition. Render Blueprint exposes the new secret slot.

**Still open before S1 is complete:**

1. **API integration tests:** authenticated/unauthenticated requests are now exercised against a running Nest HTTP server in CI; expand these tests as endpoints and policies change.
2. Create separate Render-managed runtime, migration and worker credentials, run the tested role bootstrap on Render, grant least-privilege access, and verify deployment using the split URLs.
3. Complete organization-membership context and auth-bootstrap policy design. Session hash and database-resolved user ID are now applied transaction-locally to ordinary pool queries and explicit transactions; concurrent-request and connection-context tests are in CI.
4. Expand the CI-only RLS pilot to the complete sensitive-table inventory, including login/registration/TOTP bootstrap and organization membership. Only then promote RLS and FORCE RLS to production after auth-bootstrap, cross-user, cross-organization and pool-reuse tests pass.
5. Add database-role/RLS integration tests and verify audit-event append-only permissions under the actual runtime role.
6. Set GitHub main-branch protection so required CI checks and independent review cannot be bypassed. The repository currently has no GitHub rulesets visible to the connected integration; branch-protection settings require owner-level dashboard access.
7. Review and remediate the remaining moderate/low dependency advisories, then decide whether to raise the SCA gate to moderate.

### Phase S2 — Identity, verification and financial crime controls

1. Select and integrate a third-party KYC/KYB identity-verification provider (evaluate Sumsub and Onfido/Entrust); TradeMate will not build document verification itself.
2. Implement verified webhook handling, signature validation, replay protection, status reconciliation and auditable case outcomes.
3. Add risk-based AML/sanctions screening and ongoing monitoring appropriate to the supported jurisdictions and product scope.
4. Evaluate Chainalysis, Elliptic or TRM Labs for blockchain address and transaction screening before any crypto transfer feature.
5. Evaluate verifiable credentials/attestations only where they add a clear privacy and compliance benefit.

### Phase S3 — Database, financial and transaction safety

1. Define and implement encryption-at-rest and field-level encryption for sensitive PII, with managed key rotation and access controls.
2. Verify least-privilege database and service credentials in deployed environments.
3. Build tamper-evident, append-only audit coverage for identity, account, contract, moderation and financial state changes; restrict mutation/deletion paths.
4. Specify and threat-model any escrow/payment state machine before implementation, including funding, release, refund, dispute, timeout, reconciliation and failure recovery.
5. Keep custody out of scope unless separately approved. Evaluate non-custodial wallet flows, MPC and multisig only after legal, compliance and independent security review.
6. Require step-up authentication for high-risk account, contract and financial actions; retain TOTP and evaluate passkeys/WebAuthn.

### Phase S4 — Architecture and infrastructure hardening

1. Establish explicit service boundaries for Identity, Contracts, Escrow/Payments (only if approved) and Notifications; extract services only when justified by operational and security needs.
2. Apply Zero Trust principles, service-to-service authentication, scoped authorization and auditable access.
3. Configure and verify Cloudflare DNS, WAF, DDoS protections and security headers for production domains.
4. Review secrets management, network exposure, backups, restore procedures, logging, alerting and incident response.
5. Complete the planned cloud-platform migration described in **Cloud infrastructure migration programme** below. Render remains the current confirmed hosting/database platform until a migration is approved, executed and verified; the roadmap items below are future targets, not claims of current use.

### Cloud infrastructure migration programme — planned, not yet deployed

**Objective:** move TradeMate from its current Render-hosted application and managed PostgreSQL foundation to a production-grade cloud architecture with managed networking, database, caching/queues, real-time connectivity, CDN and operational controls. This work is planned for an upcoming migration. No AWS or GCP deployment, CloudFront distribution, dedicated WebSocket service, Redis deployment or queue-worker fleet is confirmed as active today.

#### 1. Cloud provider decision and landing zone

- Evaluate **AWS** and **Google Cloud Platform (GCP)** against total cost, regional availability/latency for TradeMate's users and providers, managed PostgreSQL compatibility, networking, security services, operational complexity, support and exit/migration costs.
- Select one primary cloud provider for the initial migration. Do not deploy duplicate AWS and GCP production stacks without a documented multi-cloud requirement, resilience case and operating budget.
- AWS target option: a managed landing zone with separate production/staging environments or accounts, IAM roles, VPC/private subnets, security groups, centralized audit logs, KMS, secrets management, budgets and policy guardrails.
- GCP target option: an equivalent organization/folder/project structure, IAM, VPC/private networking, Cloud KMS, Secret Manager, centralized audit logs, budgets and policy guardrails.
- Document the target architecture, regions, data residency, threat model, service ownership, recovery objectives (RPO/RTO), cost model and rollback strategy before provisioning.
- Keep staging and production isolated. Never copy production secrets into staging or development.

#### 2. Application hosting and service topology

- Move the API, web frontend, exchange-feed service and background workers to managed compute on the selected cloud. Evaluate AWS ECS/Fargate or EKS and GCP Cloud Run or GKE; choose the least operationally complex option that meets scaling and networking requirements.
- Keep independently scalable workloads separate: web/API, market/exchange feed, real-time gateway and asynchronous workers. Do not split into microservices solely for fashion; establish clear service boundaries and operational ownership first.
- Add health/readiness checks, graceful shutdown, autoscaling limits, deployment rollbacks, resource limits, structured logs, distributed tracing and service-level dashboards.
- Use private service-to-service networking wherever possible; expose only required public entry points through a controlled load balancer/API gateway.

#### 3. Managed PostgreSQL migration

- Plan migration from Render Managed PostgreSQL to **Amazon RDS for PostgreSQL/Aurora PostgreSQL** (AWS option) or **Cloud SQL for PostgreSQL** (GCP option).
- Verify PostgreSQL version/extension compatibility, collation/time-zone behaviour, connection limits, TLS certificate validation, private connectivity, backups, point-in-time recovery, high availability, read replicas and maintenance windows.
- Separate runtime, migration and worker database identities; enforce least privilege and validate RLS/tenant isolation and append-only audit permissions under the actual deployed roles.
- Rehearse full backup/restore and data migration on a non-production copy. Measure migration duration, data consistency, application cutover and rollback.
- Define a zero/low-downtime cutover plan, write-freeze or replication strategy as appropriate, post-cutover integrity checks and a tested rollback path. Do not retire the Render database until the new database is verified and an approved retention window has elapsed.

#### 4. CDN, DNS and edge protection

- Deploy **Amazon CloudFront** if AWS is selected, or the equivalent GCP Cloud CDN if GCP is selected, for static web assets and approved cacheable content.
- Configure origin protection, TLS, cache policies, compression, immutable asset caching, invalidation strategy and correct cache-control headers. Never cache authenticated/private API responses or user-specific data publicly.
- Use **Cloudflare** for authoritative DNS and, subject to the final architecture decision, WAF, DDoS mitigation, bot controls and edge security. Decide explicitly whether Cloudflare or the cloud CDN owns each caching/routing layer to avoid conflicting proxy, TLS and cache behaviour.
- Verify DNS cutover, certificate renewal, origin lockdown, security headers, rate limits and recovery from CDN/WAF misconfiguration before production traffic is moved.

#### 5. Dedicated real-time / WebSocket capability

- Design and deploy a dedicated, horizontally scalable **WebSocket gateway/service** for live market quotes, notifications and other approved real-time updates; do not assume the existing exchange-feed process is itself a separately hosted WebSocket platform.
- Evaluate AWS API Gateway WebSocket or an ALB-fronted ECS/Fargate service on AWS; evaluate an appropriate Cloud Run/GKE or managed gateway design on GCP, accounting for long-lived connection support and platform limits.
- Define authenticated connection establishment, token/session expiry, per-channel authorization, tenant isolation, origin validation, connection quotas, heartbeat/ping-pong, reconnect/backoff, replay/resync and graceful draining.
- Specify message schemas, event versioning, delivery guarantees, ordering expectations, backpressure, fan-out strategy and stale-data indicators. Do not present stale quotes as live.
- Load-test concurrent connections, reconnect storms, fan-out latency, memory/CPU, regional failure and deployment draining before enabling production clients.

#### 6. Redis-compatible cache and asynchronous queues/workers

- Introduce managed Redis-compatible caching only for measured use cases such as short-lived quote/cache data, rate-limit counters, session coordination or ephemeral real-time fan-out. Evaluate **Amazon ElastiCache for Redis/Valkey** on AWS or **Google Cloud Memorystore** on GCP.
- Treat Redis as a cache/coordination layer, not the source of truth for contracts, balances, audit history or financial records. Define TTLs, eviction policy, persistence/failover needs, encryption, private access and cache invalidation.
- Add durable managed queues for retryable asynchronous work: evaluate Amazon SQS/SNS or EventBridge on AWS, and Pub/Sub or Cloud Tasks on GCP. Choose queue semantics per workload rather than forcing every event through Redis.
- Create independently deployable background worker processes for notifications, email, media processing, market-data normalization, scheduled reconciliation and other approved jobs. Financial or security-sensitive jobs require idempotency, deduplication, bounded retries, dead-letter queues, replay controls and auditable outcomes.
- Define message schemas/versioning, poison-message handling, visibility/acknowledgement timeouts, ordering requirements, rate limits, backpressure, queue-age alerts and graceful worker shutdown.
- Add integration tests for duplicate delivery, worker crashes, retry exhaustion, dead-letter recovery and concurrent processing. Ensure a failed worker cannot silently lose or double-apply business actions.

#### 7. Storage, secrets, observability and resilience

- Evaluate S3 (AWS) or Cloud Storage (GCP) for private user uploads and generated assets, with least-privilege access, encryption, signed URLs, malware scanning, retention/deletion policies and lifecycle rules.
- Move application secrets to AWS Secrets Manager/SSM Parameter Store or GCP Secret Manager; use workload identities/roles instead of long-lived static cloud credentials wherever possible. Rotate credentials and audit secret access.
- Centralize metrics, logs, traces, alerting and audit events; establish dashboards and actionable alerts for API latency/errors, database saturation, WebSocket health, queue age/depth, worker failures, CDN/WAF events, market-feed freshness and spend anomalies.
- Configure multi-zone availability where justified, encrypted backups, point-in-time recovery, tested restore drills, incident runbooks and documented RPO/RTO.
- Apply infrastructure as code, environment parity, policy checks, image/dependency scanning and controlled promotion through staging to production.
- Retain **GitHub Actions as the current CI/CD system** and extend it for the selected cloud: build and test immutable artifacts, scan dependencies/images and infrastructure plans, publish signed artifacts, deploy to staging, run smoke/integration/security gates, and promote the same artifact to production only after explicit approval. Use workload identity/OIDC where supported instead of long-lived cloud keys; protect deployment environments, require reviewed approvals, record provenance, and provide automated rollback/health verification.
- Keep database migrations as a separately permissioned, auditable release stage; application runtime identities must not inherit migration privileges. Test migration compatibility and rollback/forward-fix procedures before production release.

#### 8. Migration sequence and exit criteria

1. Inventory current Render services, environment variables (names only; never export secret values), database extensions/data size, DNS/domains, file storage, scheduled jobs, network dependencies, CI/CD and current traffic/latency/cost baselines.
2. Approve one cloud provider, target regions, service mapping, budget, security architecture, compliance/data-residency assessment and rollback plan.
3. Build isolated cloud landing zones and non-production infrastructure using reviewed infrastructure-as-code; configure IAM, networking, secrets, logs, backups and CI/CD.
4. Migrate and rehearse PostgreSQL, object storage and application services in staging; run schema/data integrity, RLS, authorization, performance, disaster-recovery and security tests.
5. Add and load-test the dedicated WebSocket gateway, managed cache, durable queues and worker fleet; enable clients/workloads progressively behind feature flags.
6. Conduct a production cutover only after explicit approval, successful rehearsal, verified backups, monitoring coverage, support/runbooks and a tested rollback path. No production cutover is authorized by this roadmap entry alone.
7. Retain the old Render services/database during the agreed rollback window; decommission only after consistency, stability, backup retention and cost checks are signed off.

**Migration acceptance gates:** no secrets in source control or build logs; private database/cache/queue access; TLS verification; least-privilege identities; tenant/RLS and audit-integrity tests; successful restore and rollback rehearsal; WebSocket load/reconnect tests; queue idempotency/dead-letter tests; CDN cache privacy tests; security scans; operational dashboards/alerts; cost budgets; and documented owner sign-off. Record actual provider, regions, service names, deployment IDs and verification evidence only after implementation.

### Independent audit, certification and regulatory assurance programme — planned

This programme is a procurement and readiness roadmap, not evidence that any auditor, certification body, legal adviser or monitoring provider has been engaged. Select firms through a documented RFP, scope, independence/conflict checks, references, jurisdiction coverage, deliverables, timeline and budget. Do not imply endorsement by any named provider.

#### 1. Independent technical security audit and penetration test

- Commission an independent application and infrastructure security assessment before enabling high-risk financial, escrow, custody, P2P or crypto-transfer capabilities. Potential firms to evaluate include **NCC Group**, **Trail of Bits**, **Halborn** and **Stingrai**; compare relevant fintech, Web/API and blockchain experience rather than selecting by name alone.
- Scope the assessment across the web/mobile application, public and authenticated APIs, authentication/session lifecycle, MFA/TOTP, account recovery, authorization and tenant isolation, organization/document access, contract lifecycle, proposed escrow/payment state machines, wallet/key management, crypto integrations, infrastructure, CI/CD and secrets handling.
- Require threat modelling, manual penetration testing, abuse-case testing, business-logic review, severity-rated findings, reproducible evidence, remediation guidance and an independent retest of critical/high findings. Include source-code review where appropriate.
- Keep escrow, custody and crypto-transfer components explicitly marked **not in scope / not implemented** until they actually exist; when introduced, commission a dedicated assessment of their state machines, key custody/signing boundaries, replay/idempotency, settlement, refund/dispute and recovery paths.
- If TradeMate later deploys smart contracts, tokenization or on-chain settlement, commission a specialist smart-contract/protocol audit before mainnet deployment. Evaluate firms with demonstrable expertise in the target chain, language, protocol design, economic attack analysis and formal verification where warranted. Require remediation and retest; a general web-app penetration test is not a substitute.

#### 2. SOC 2 Type II and ISO/IEC 27001 readiness

- Run a readiness/gap assessment against **SOC 2 Trust Services Criteria** and **ISO/IEC 27001** before seeking formal examination/certification. Potential SOC 2 audit firms to evaluate include **A-LIGN**, **Schellman** and qualified Big Four practices; independently verify accreditation, auditor eligibility, scope and relevant experience.
- Establish the control environment first: security governance, risk register, asset/data inventory, access reviews, joiner-mover-leaver controls, vendor management, secure SDLC, change/release approvals, incident response, business continuity, backup/restore tests, vulnerability management, logging/monitoring, privacy/data retention and evidence ownership.
- Define the audit boundary and system description accurately, including production/staging environments, cloud/service providers, subprocessors, data flows and exclusions. Close readiness gaps and collect operating evidence over the required observation period before a SOC 2 Type II examination; do not describe a readiness review as a Type II report.
- Build and operate an ISO/IEC 27001-aligned Information Security Management System (ISMS), including risk assessment, risk treatment plan, Statement of Applicability, internal audit, management review and corrective actions. Select an appropriately accredited certification body for the formal certification audit.
- Treat SOC 2 Type II as an independent attestation report and ISO/IEC 27001 as a certifiable management-system standard; they are complementary, not interchangeable. Confirm exact scope, period, exceptions and report-sharing terms before making claims to customers or investors.

#### 3. Regulatory and specialist legal review

- Retain qualified fintech/crypto counsel, and where useful a Big Four regulatory practice, to map TradeMate's actual operating model and user/customer jurisdictions before launching regulated features. Evaluate the laws and licensing/registration obligations relevant to identity/KYC/KYB, AML/sanctions, payments, money transmission, custody, crypto-assets, securities/derivatives, consumer protection, privacy/data protection, real-estate brokerage and tokenization, advertising and cross-border transfers.
- Produce a written jurisdiction-by-jurisdiction legal perimeter memo covering entity structure, products, counterparties, funds/assets flow, custody/control, third-party providers, marketing, licensing triggers, reporting duties and prohibited activities. Include Nigeria and any other markets only where TradeMate actually operates or targets users; do not assume a single global answer.
- Obtain separate specialist advice before offering escrow, payment handling, wallet custody, crypto transfers, tokenized real estate, investment products or derivatives. Product design and engineering must follow the resulting written legal advice; no feature is authorized merely by inclusion in this roadmap.
- Reassess the legal perimeter whenever a new country, asset, payment rail, custody model, marketplace category or material business flow is introduced.

#### 4. Ongoing monitoring and continuous security testing

- Before any crypto transfer or wallet-related regulated flow, evaluate **Chainalysis**, **TRM Labs** and **Elliptic** for wallet/address screening, sanctions exposure, transaction monitoring, risk scoring, case management, data coverage, false-positive handling, API reliability, privacy, retention, cost and jurisdictional suitability. Integrate only after legal/compliance approval, documented risk policy, human escalation and auditable decisions.
- Maintain continuous dependency/SCA, secret scanning, SAST, infrastructure-as-code scanning and authenticated DAST in safe environments; add external attack-surface monitoring and recurring independent penetration tests based on risk and material changes.
- Establish vulnerability SLAs, security alert triage, incident escalation, evidence retention, provider outage procedures, false-positive review and periodic tuning. Monitor wallets/transactions only where the product actually handles or facilitates them and the legal basis is established.
- Repeat independent technical reviews after material changes to identity, authorization, contracts, escrow/payment, wallet/key management, smart contracts, cloud architecture or threat exposure; track findings through verified remediation and retest.

#### 5. Procurement, investor and partner evidence

- Compare Big Four providers and specialist firms on independence, scope depth, relevant technical/regulatory expertise, report quality, ability to retest, timelines and total cost. Big Four firms may carry broader institutional recognition; specialist firms may offer deeper focused technical work or better early-stage value. Validate both claims through references and the proposed team rather than assuming either category is automatically superior.
- Many institutional customers, banking partners and investors may request a recent independent penetration test and SOC 2 evidence; expectations vary by counterparty, geography, product risk and maturity. Treat these as common diligence considerations, not universal legal requirements or a guarantee of funding/partnership.
- Maintain a controlled assurance pack: current architecture and data-flow diagrams, policies, risk register, penetration-test executive summary, remediation/retest status, SOC 2 report when issued, ISO certificate and scope when achieved, legal perimeter memo, vendor/subprocessor register, incident/BCP evidence and dated control attestations. Share confidential reports only under appropriate NDA and access controls.

### Phase S5 — Continuous assurance

1. Maintain threat models for identity, contracts, high-value property/business deals, P2P and any future crypto withdrawal or payment capability.
2. Make security review and automated checks mandatory release gates.
3. Add authenticated DAST (for example OWASP ZAP) in a safe test environment and remediate findings.
4. Commission an independent penetration test before enabling high-risk financial functionality; track remediation and retest.
5. Repeat access-control, privacy, dependency and infrastructure reviews on a scheduled basis.

### Security implementation order and release gates

- Start with S1: strict TypeScript and Zod, then database-role/RLS design and isolation tests, then CI security gates and SSDF/threat-model documentation.
- Proceed to S2 provider selection and integration only after the data flows, jurisdictions, retention rules and vendor responsibilities are documented.
- Complete S3 financial controls before any escrow, custody, payment or crypto-transfer feature is enabled.
- Complete S4 and S5 hardening and independent assurance before high-risk financial features go live.
- RLS must not be bulk-enabled until runtime roles, tenant/user context, transaction boundaries and connection-pool behaviour are tested.
- No security phase is considered complete based only on code being committed; require passing tests, deployment verification and recorded evidence.
