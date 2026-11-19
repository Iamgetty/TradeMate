# TradeMate roadmap

This roadmap records the current product direction. It is not a claim that each item is already implemented or deployed.

## Current product principles

- TradeMate connects counterparties; it is not a conventional exchange or product checkout.
- The core outcome is a mutually agreed business contract.
- Explore separates ten Contract Categories (Services, Real Estate, Software, B2B, Industrial & Trade, Agriculture, Finance & Investment, Institution & Infrastructure, Sports Transfer and Entertainment) from the four Marketplaces (P2P, NFTs, Forex and Crypto). All ten Contract Categories share the persistent review-submission workflow; P2P remains separate.
- Product listings and product-cart commerce are out of scope for the current build. A dedicated product marketplace may be reconsidered in a future version, subject to a deliberate product decision. It must not silently reappear in the current app.
- Keep P2P separate from the current marketplace contract workflow.

## Current implementation snapshot

The following implementation is present in the merged application history and current production baseline to varying degrees. Deployment evidence and outstanding end-to-end verification are recorded separately below; code presence must not be treated as workflow acceptance.

- **Product removal:** current Product category, product-cart UI and conventional marketplace transaction writes have been removed. Migration `009` converts legacy Product listing records to the explicit B2B type; historical migration files remain unchanged for reproducible database history.
- **B2B:** API and database now use `b2b` as a distinct listing type rather than reusing `product`.
- **Contracts and all ten divisions:** all ten Explore contract categories share the persistent listing draft, submission-for-review, moderation, approval and public-discovery path. `division` is stored independently from `listing_type` (which continues to distinguish Services-style offers from B2B inventory). Signed-in organization owners, admins and members can submit offers; pending offers remain private until moderator approval. P2P remains separate. Contract proposal and fulfilment workflows continue to use the shared contract lifecycle. No payment, escrow or e-signature is included. Full category-by-category live acceptance remains required.
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
| All ten contract-category publishing and discovery | **All-ten PostgreSQL moderation lifecycle covered; live acceptance remains** | `apps/api/scripts/test-marketplace-listings.js` iterates all ten division slugs for owner, admin and member roles, verifying durable draft creation, review submission, pending-review privacy, moderation-queue division, rejection, continued privacy while rejected, resubmission to pending review, approval, public discovery and contract proposal creation. PR #155 adds the rejection/resubmission cycle; all eight CI jobs passed in run [44002795879](https://github.com/Iamgetty/TradeMate/actions/runs/44002795879). Remaining: category-filter UI and production moderation acceptance. |
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
- **Historical audit items requiring fresh verification:** account profile fields/photos, follow/highlight workflows, organization image upload, OAuth/account linking, password reset, KYC, wallet/ledger, support/feedback/notification paths, promotion/referral workflows, specialist division workflows and local-only preferences. Do not assume the November 1 audit remains current; several backend connections have since been added.

### Next execution order

1. **Exact-head CI and browser QA — merged baseline; live acceptance remains.** PR #79 was merged on 8 November 2026 as `2eec784074647936975954eab9fc854922638ee6`; its six-job CI and browser retry/two-account mocked contract tests are historical regression evidence, not outstanding review work. Subsequent PRs have extended the baseline. The latest feed-client source-boundary audit, PR #125, is merged as `eca423b3c952a27a8d4d32070d4d2980c7368361`; all eight CI jobs passed in run [43375530510](https://github.com/Iamgetty/TradeMate/actions/runs/43375530510), including database migration integration, browser app-shell smoke tests, API/web builds, security scanning, Cloudflare frontend, exchange-feed/MT5 and container builds. CI does not establish live two-account API/database acceptance or production user acceptance.
2. **All-ten listing API/database coverage — integration tests present; production acceptance remains.** `apps/api/scripts/test-marketplace-listings.js` exercises all ten divisions across owner/admin/member roles through draft creation, submission, moderation, public discovery and contract proposal creation against PostgreSQL. The same suite separately exercises B2B inventory, own-offer visibility, unrelated-account denial, submission audit, pending-review privacy and enquiry behaviour. `apps/api/scripts/test-marketplace-contracts.js` exercises contract access, messaging, seller decisions, cancellation, dual fulfilment confirmation and closed-state behaviour against PostgreSQL. Preserve these as automated integration evidence; the browser two-account contract journey still uses mocked API responses, so live UI-to-API-to-database acceptance across two real accounts remains outstanding.
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

### Controlled P2P foundation work — 13 November 2026

The product owner has explicitly directed a limited P2P safety and lifecycle foundation audit while the broader pre-P2P acceptance register remains open. This is a scoped engineering exception for tests, precision, auditability and workflow design; it does **not** waive the pre-P2P release gates or authorize live crypto trading, escrow, custody, payment processing, refunds, settlement or transfers.

- **PR #101 — lifecycle and financial-precision audit:** documented the original gaps and a safe implementation order.
- **PR #102 — PostgreSQL lifecycle/concurrency tests:** added HTTP integration coverage for public/private access, self-trade prevention, quantity reservation/restoration, payment-state transitions, disputes, privacy and competing reservations.
- **PR #103 — exact financial arithmetic:** replaced floating-point P2P calculations with fixed-point/BigInt handling and validation aligned to database precision (price 10dp, asset quantity 12dp, fiat 2dp).
- **PR #104 — transactional audit events:** paired the covered P2P state changes with audit inserts in the same transaction and tested rollback when audit insertion fails.
- **PR #105 — dispute-review design:** documented reviewer accountability, privacy and authorization requirements. The shared moderation API key is not sufficient to establish named reviewer identity; a separately authenticated and authorized reviewer model is still required before implementing resolution actions.
- **PRs #106–#107 — limited UI scope:** PR #107 is the retained version. The homepage introductory copy removal and Services → Announcements navigation are retained; the other unrequested UI refinements were rolled back. PR #107 is merged and its Render web deployment is confirmed live. Event-triggered, audience-targeted announcement publishing remains unimplemented.

**Next P2P engineering gates (not yet complete):**

1. Define named reviewer identity, role/permission boundaries, case assignment, decision reasons, separation of duties, privacy and immutable audit requirements before adding dispute resolution endpoints. A review decision must not claim to reverse an external payment or release escrow.
2. Specify advertisement and pending-order expiry rules before implementing jobs: distinguish unpaid orders from orders where payment was marked sent; define reservation restoration, dispute freezes, race handling, idempotency, audit events, retry/dead-letter behaviour and user notifications. Never auto-cancel a payment-sent or disputed order under an unapproved timeout rule.
3. Add expiry implementation only after the state machine is approved and covered by PostgreSQL-backed concurrency, duplicate-job, crash/retry and audit-rollback tests.
4. Keep all financial movement, wallet, deposit/withdrawal, remittance, escrow and custody capabilities gated by the legal/compliance, threat-model and independent-assessment requirements in S2–S5.

The pre-P2P completion register above remains authoritative for broad product readiness. P2P foundation work does not mark Services/B2B, contract, Feed, Forex/Crypto/NFT, mobile or application-wide acceptance as complete.

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
5. **RLS pilot test-target protection — implemented in this branch; CI pending:** `scripts/test-rls-pilot.js` now requires the dedicated `RLS_PILOT_TEST_DATABASE_URL`, rejects generic `DATABASE_URL` fallback, requires a loopback PostgreSQL host and an explicitly test/CI-named database, and has five regression cases. The CI job supplies the dedicated URL for its disposable `trademate_test` database. This protects the test harness; it does not enable RLS or complete production role/policy rollout.
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

#### 0. Read-only discovery and baseline audit — first gate

- Confirm the intended Render workspace before inspecting live resources; inventory web services, private services, workers, cron jobs, PostgreSQL, Key Value, regions, plans, linked repositories/branches, deploy policies, health checks, domains and current live deploy IDs.
- Record environment-variable **names and presence only**. Never retrieve, export, print, commit or copy secret values. Map each variable to its owning service and classify it as secret, public build-time configuration or operational setting.
- Inventory database engine/version, region, size, extensions, connection limits, backup/PITR configuration, retention, restore evidence, migration process, roles/privileges and application connection paths. Do not run data-changing SQL.
- Inventory public domains, DNS provider/records, TLS certificates, origin exposure, CDN/proxy/cache behaviour, object/file storage, uploads, scheduled tasks, queues, WebSocket/feed dependencies and third-party integrations.
- Establish a baseline for request volume, p50/p95 latency, 4xx/5xx rates, CPU, memory, bandwidth, database connections, storage growth, deploy frequency/failure rate, incident history and current monthly spend. Use available historical metrics and label missing telemetry explicitly.
- Review GitHub Actions workflows, required checks, deployment triggers, environment protection, artifact provenance, dependency/image/IaC scans and rollback process. Verify which workflow actually deploys each Render service.
- Produce a dependency/data-flow diagram, current-state inventory, risk register, cost baseline, regional/data-residency questions and evidence-backed gap list. No production configuration or data is changed during this gate.
- **Workspace selection is required before the live Render audit can continue** if more than one workspace is available. Record the selected workspace ID in the audit evidence; do not infer it from a service name.


**Objective:** move TradeMate from its current Render-hosted application and managed PostgreSQL foundation to a production-grade cloud architecture with managed networking, database, caching/queues, real-time connectivity, CDN and operational controls. This work is planned for an upcoming migration. No AWS or GCP deployment, CloudFront distribution, dedicated WebSocket service, Redis deployment or queue-worker fleet is confirmed as active today.

#### 1. Cloud provider decision and landing zone

- **Approved direction: hybrid edge + AWS primary.** Use AWS as the primary application/cloud platform; Cloudflare for authoritative DNS, WAF, DDoS mitigation, bot controls and edge security; and Amazon CloudFront for AWS-origin static assets and explicitly approved cacheable content. Define one owner for each DNS, proxy, TLS, WAF and cache responsibility to avoid overlapping Cloudflare/CloudFront behaviour.
- Keep **GCP optional**, not a parallel production stack. Evaluate a specific GCP service only when a measured capability, regional, resilience or commercial advantage justifies the added operational and compliance burden. Do not duplicate the core production platform across AWS and GCP by default.
- Compare AWS regions and service choices against TradeMate's actual user/provider geography, latency, data-residency obligations, PostgreSQL compatibility, availability, support, operational complexity, exit costs and a workload-based total-cost model before selecting a region or provisioning resources.
- This architecture direction is not authorization to create cloud accounts/resources, change DNS, copy production data, alter secrets, or cut over production. Those actions require separate explicit approval.
- AWS target: a managed landing zone with separate production/staging accounts or equivalent isolation, IAM roles, VPC/private subnets, security groups, centralized audit logs, KMS, secrets management, budgets and policy guardrails.
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

## Engineering maintainability and deployment assurance backlog — 13 November 2026

This section records the five engineering observations raised during the ongoing repository audit. It supplements the existing roadmap and does not reorder product phases or authorize production changes.

### A. Frontend architecture — planned audit and incremental cleanup

- Preserve the current Next.js application shell and the established legacy JavaScript runtime as distinct, documented layers while both remain in use. Do not replace, duplicate or bypass existing flows merely to introduce a new page or component.
- Map ownership of routes, navigation, authentication/session state, API access, shared UI state, styles and runtime bootstrapping across Next.js pages/components and the legacy bundle.
- Establish explicit integration contracts for data/configuration/events between the Next.js shell and legacy runtime; document which layer owns each feature and its source of truth.
- Before adding functionality, search both layers for an existing implementation and reuse or deliberately migrate it rather than creating parallel screens, handlers, state stores or API calls.
- Add regression coverage for route loading, authentication hand-off, navigation, desktop/mobile breakpoints, API failures and runtime startup. Refactor in small, independently testable slices; retain a rollback path and protect the working app shell from blank-screen regressions.
- Do not undertake a wholesale rewrite or remove the legacy runtime until feature parity, accessibility, performance and end-to-end acceptance are demonstrated.

### B. Backend maintainability — gradual NestJS module extraction

- The current NestJS API has a large central module implementation. Gradually separate cohesive domains into independently testable NestJS modules/providers/controllers: Authentication & Identity, Marketplace/Listings, Contracts, P2P, Feed and Moderation.
- First document the existing route, service, database, authorization, validation, audit-event and transaction ownership for each domain. Extract without changing endpoint contracts, permissions, schema semantics or user-visible behaviour.
- Keep shared database context, session/authentication guards, validation, audit primitives and common infrastructure explicit; avoid circular module dependencies and duplicated business logic.
- Move one domain at a time behind compatibility-preserving module boundaries. Add unit and PostgreSQL-backed HTTP integration tests for lifecycle, authorization, transaction rollback, concurrency and audit atomicity before and after each extraction.
- Preserve migration history and keep P2P financial/escrow functionality gated by the existing legal, compliance, threat-modelling and independent-audit requirements. Do not split into independently deployed microservices merely for code organization; deployment separation requires a measured operational/security case.

### C. Production database security — outstanding release gate

- Continue the existing S1 gates: provision distinct least-privilege Render runtime, migration and worker credentials; verify grants and connection URLs in the deployed environment; keep migration privileges out of the API runtime identity.
- Complete the sensitive-table RLS inventory and CI-only policy pilot, including registration/login/TOTP bootstrap and organization membership context. Test authenticated and unauthenticated access, cross-user and cross-organization isolation, transaction-local identity, rollback and pooled-connection reuse.
- Verify append-only audit-event permissions under the actual runtime role. Record deployment evidence and a rollback/forward-fix plan.
- Activate production RLS/FORCE RLS only after the complete test matrix passes and the owner explicitly approves the production change. CI success or the existence of policies is not production activation evidence.

### D. Contributor documentation — required correction

- Keep README-LOCAL-SETUP.md aligned with the actual Next.js/React web app, NestJS API, PostgreSQL-backed migrations/authentication/marketplace workflows, and the separate exchange-feed service. The former landing-page-only description is obsolete.
- Document current local prerequisites, service startup commands, required environment-variable names (never secret values), database migration safety, test/build commands and the distinction between local development, staging and production.
- Review this guide whenever service topology, scripts, authentication, migrations or deployment configuration changes. Documentation must distinguish implemented code from features that still require provider setup, deployment or end-to-end acceptance.

### F. Exchange-feed reliability — audit findings 13 November 2026

- The Render log sample shows recurring Binance spot and Bybit spot/linear WebSocket close/reconnect cycles; the sampled sockets recovered and Twelve Data refreshes succeeded. Treat this as connection churn requiring measurement, not proof of sustained outage.
- The shared reconnect helper resets its retry counter on every socket open, so repeated short-lived sessions can retry at one-second intervals instead of reaching bounded exponential backoff.
- `GET /health` reports process liveness with `ok: true` regardless of upstream feed availability. Add separate feed readiness/diagnostics; do not make platform liveness depend on third-party provider uptime.
- Existing feed tests cover MT5 quote validation but no dedicated reconnect/backoff, feed readiness, provider silence or stale-book recovery suite was found.
- Next: extract deterministic reconnect/health logic, test repeated open/close cycles and recovery with fake sockets, add per-provider last-message age and stale-book diagnostics, then deploy the exchange-feed service independently after CI. Do not claim continuous market-data acceptance from successful reconnect logs alone.
- See [exchange-feed operational reliability audit](exchange-feed-operational-audit.md). No live provider configuration, secrets, runtime behaviour or production data were changed by the audit.

### E. Deployment verification — three-service acceptance gate

- Treat the Render Blueprint as three separately verifiable services: trademate-api, trademate-web and exchange-feed. Verify each service's actual deployed commit, build/release result, health endpoint, environment configuration by variable name/presence only, logs and dependency connectivity.
- Verify the web-to-API origin/proxy, API-to-PostgreSQL access, and web/API-to-exchange-feed data path, including authentication/CORS where applicable, feed freshness, stale-data handling and recoverable outage behaviour.
- Record deployment IDs, commit SHAs, timestamps, health results and smoke-test evidence for each service. A Blueprint definition, successful CI run or one healthy service does not establish that all three are live and correctly connected.
- Keep production migrations separately permissioned and explicitly approved. Do not trigger a deployment, migration, DNS cutover or production configuration change as part of this roadmap audit alone.

### Current cross-reference status

- Email verification for new registrations was merged in PR #97 (merge commit 41a2cdffa5a9d47b43e6d2dbfd6ea0f80ac6ff59) after all exact-head CI workflows passed. The migration is registered and clean-database migration integration passed; applying it to a live database and verifying the deployed email-provider configuration remain outstanding.
- The production database-role/RLS work remains open under Phase S1; this section clarifies the production activation gate rather than marking it complete.
- Live deployment verification remains outstanding until all three Render services have individually recorded deployment and end-to-end connectivity evidence.


### Exchange-feed readiness diagnostics — implementation gate

- Preserve `GET /health` as process liveness for Render; upstream-provider outages must not cause platform restart loops.
- Add a separate `GET /ready` diagnostic that reports active/total upstream feeds, per-provider last-message age, observed/fresh/stale order-book counts and FX quote freshness without exposing provider error text, credentials or account details.
- Readiness is successful only when at least one upstream feed is receiving recent market data and at least one order book is fresh. Partial provider availability remains explicitly `degraded`; FX freshness is reported separately and does not determine crypto-book readiness.
- Keep readiness out of the Render restart health-check configuration. Use it for monitoring/diagnostics until an explicit alerting and service-level policy is approved.
- Require deterministic unit tests for healthy, partial, silent and stale states, plus exact-head CI and a feed-only deployment. Verify recovery and freshness from runtime diagnostics before marking operational acceptance complete.


### Contract lifecycle acceptance coverage — follow-up

- Expand the PostgreSQL-backed two-account integration matrix to verify ordinary seller members cannot confirm fulfilment, unauthorized parties cannot cancel, and rejected/cancelled/completed contracts reject further messages.
- Verify a buyer cannot cancel after seller acceptance and that unauthorized attempts leave the durable contract state unchanged.
- Keep owner/admin decision and fulfilment permissions explicit; do not widen seller-member authority without a product-owner decision.
- These tests validate the existing contract state machine; they do not add payment, escrow, e-signature, dispute resolution or funds movement.


### Services/B2B moderation and discovery acceptance coverage — implemented in current main; production acceptance remains

- The PostgreSQL-backed listing integration suite covers B2B inventory creation, own-offer visibility, unrelated-account submission denial, submission audit, pending-review privacy, reviewer-key-protected moderation, approval/public discovery and enquiry creation.
- The all-ten division matrix also verifies owner/admin/member submission and category-aware moderation/discovery.
- Keep live two-account UI-to-API-to-database acceptance outstanding; automated integration coverage is not proof of production user acceptance. Organization-member permissions and the single-organization account model remain unchanged.


### B2B publishing wizard inventory handoff — implemented in current main

- The publishing wizard maps a whole-number B2B quantity to the API `quantityAvailable` field. Non-numeric quantity/scope text remains in the offer description, and the quantity prompt is not duplicated there when a numeric inventory value is supplied. Services publishing remains separate.


### B2B public offer detail inventory presentation — implemented; browser regression coverage present

- Public listing details render persisted `quantity_available`, distinguish zero from unspecified inventory, and do not show B2B inventory labels on Services. PR #151 adds browser coverage for zero inventory and Services detail semantics; positive and null inventory are covered by existing detail tests. This is presentation only, not stock reservation or decrement.


### Marketplace enquiry and reply notifications — follow-up

- Send persistent in-app notifications to seller organization owners/admins when a buyer creates an enquiry, and notify the opposite party when a conversation reply arrives.
- Include a direct `/messages/:id` action link and commit notifications in the same transaction as the enquiry/message and audit event.
- Preserve the existing owner/admin notification audience for seller-side enquiries; do not notify every ordinary organization member.
- Verify buyer/seller notification routing, audience isolation and rollback with PostgreSQL-backed integration tests.


### Notification action-link navigation — source implementation present; acceptance evidence to confirm

- The current app runtime marks a notification read before following a stored same-origin path, and rejects protocol-relative or backslash-containing destinations. Confirm dedicated browser coverage for conversation routing and retain that as the remaining acceptance check.


### Browser exchange-feed client reconnect resilience — follow-up

- Keep the browser client's retry counter across short-lived successful handshakes; reset it only after a sustained connection has delivered valid feed data.
- Use bounded equal-jitter exponential reconnect delays, prevent duplicate reconnect timers, and cancel pending reconnect/stability timers when the client is explicitly closed.
- Add deterministic fake-WebSocket and fake-timer tests for repeated short-lived connections, stable recovery, duplicate close events and explicit shutdown.
- This complements the exchange-feed server reconnect policy; it does not claim provider freshness or change upstream credentials/configuration.


### Marketplace authentication return and draft continuity — follow-up

- Preserve a same-origin return path through login and the optional two-factor challenge so unauthenticated users return to the marketplace offer or enquiry conversation they were trying to access.
- Preserve unsent marketplace enquiries and conversation replies in tab-scoped session storage when a request returns 401; restore the draft on return and clear it after a successful send.
- Reject external, protocol-relative and backslash-containing return destinations to prevent open redirects.
- Add browser coverage for login return, marketplace enquiry draft restoration and expired-session conversation reply recovery.

## Third-party integration register — mandatory build reference

The canonical inventory of current, planned, candidate, alternative, placeholder and unselected external providers is maintained in [`third-party-integrations.md`](third-party-integrations.md). Check it before every build session and update it in the same PR whenever an integration decision or dependency changes. Do not treat listed candidates or cloud targets as selected or deployed.


## Sports Transfer — complete global experience (football and basketball first)

**Approved product scope, 17 November 2026:** Sports Transfer is a complete global sports recruitment, player-movement and transfer-transaction experience. Football (soccer) and basketball are the first supported sports. The platform is extensible to other sports, but each sport must have its own transaction types, rules and state machines. This is an approved roadmap specification, not a claim that the feature is implemented or live.

### 1. Transfer and movement types

**Football**
- Permanent transfer between clubs.
- Domestic and international transfers.
- Straight loan, loan with option to buy, loan with obligation to buy, and permitted loan extensions or recalls.
- Free-agent / out-of-contract signing.
- Pre-contract agreement where permitted by applicable rules and contract status.
- Player exchange / swap, including cash-plus-player structures.
- Transfer with instalments, conditional add-ons, performance bonuses and sell-on clauses.
- Youth / academy movement and development-related arrangements, subject to strict minor safeguards and applicable rules.
- Trial, training opportunity and scouting invitation (not represented as a transfer).
- Contract renewal, extension, termination by mutual agreement and release (distinct from a transfer).
- Women's, men's, amateur and other eligible football pathways with their own association/competition rules.

**Basketball**
- Free-agent signing and re-signing; restricted and unrestricted free agency where the competition recognizes those concepts.
- Direct player trade, multi-player trade and multi-team trade.
- Trade involving permitted draft rights/picks or other league-approved consideration.
- Waiver placement, waiver claim and clearance; distinguish waiver from free agency.
- Draft declaration, draft rights, selection and signing workflows where applicable.
- Contract assignment, transfer, buyout, release, termination and renewal where permitted by league rules.
- International transfer / federation clearance and domestic league movement.
- Temporary assignment, loan or two-way/development arrangement only where the relevant league and contract permit it.
- Training-camp, tryout and recruitment invitation (not represented as a completed player movement).

**Shared classification rule:** a listing, scouting lead, trial, negotiation, signed agreement, league-approved move and official registration are different objects/states. Never label a rumour, interest or unsigned offer as a completed transfer. Each transaction type is enabled only for the relevant sport, competition, season and rule profile.

### 2. Global Transfer-Window Centre

A dedicated Transfer-Window Centre will provide:
- Global calendar with filters for sport, country, association/federation, league, competition, gender/category, age group and season.
- Opening/closing dates, local time zone, countdowns, deadline-day view, upcoming windows and recently closed windows.
- Separate registration windows, transfer windows, trade deadlines, waiver periods, free-agency periods, draft dates and other competition-specific periods.
- Rules and eligibility notes per competition, including exceptions, registration limits and relevant international clearance requirements.
- Source attribution, last-verified timestamp, effective date, historical versions and correction history for every window.
- Alerts and saved calendars for clubs, agents, players and scouts; deadline reminders for offers, options, loans, registrations and document expiry.
- Calendar subscriptions/export and localized date/time display.
- Distinct status for confirmed official dates, provisional dates and unverified reports.

Window data must be competition-specific and versioned. No universal football window or basketball deadline may be assumed. Official association/league sources take precedence; commercial feeds can supplement but cannot silently override authoritative rules.

### 3. People, organizations and authority

**People**
- Players/athletes, with personal profile, sporting profile, position/role, career history, availability preferences and consent settings.
- Parents/legal guardians for minors, with restricted and auditable authority.
- Licensed or otherwise authorized agents/intermediaries and their client mandates, scope, territory and expiry.
- Club executives, sporting directors, general managers, recruitment leads, coaches and authorized negotiators.
- Scouts and talent-identification staff, with limited access to permitted sporting information.
- League/federation/association registration and compliance officers where formal access or review is authorized.
- Lawyers, player representatives, translators and other invited professional advisers with scoped, revocable access.
- TradeMate moderators, trust-and-safety reviewers and dispute specialists with least-privilege internal access.

**Organizations**
- Professional and amateur clubs, teams, academies and development programs.
- National associations, federations, leagues, competitions and governing bodies.
- Licensed agencies and representation firms.
- Schools, universities and other eligible institutions where the competition rules allow participation.
- Approved medical/fitness professionals only for specific, consented workflows—not as public profile viewers.
- Data and verification providers.

Every organization needs verified legal identity, official sporting identity where applicable, authorized signatories, role-based members, evidence and review history. A person acting for a club must prove authority; a club account must not automatically gain control of a player's profile. Agency membership alone does not prove a valid player mandate.

### 4. Complete transfer transaction lifecycle

1. **Onboard and verify:** verify the club/team, player identity, representative authority, agent mandate and required organization records.
2. **Create opportunity:** publish a public, private or invitation-only player availability, club need, recruitment brief or permitted transaction proposal.
3. **Set permissions and consent:** confirm who may see the opportunity, contact the player, represent them and access documents; record consent scope, timestamp, expiry and withdrawal.
4. **Discover and shortlist:** search and filter by sport, position, age eligibility, competition, location, availability, contract status, budget/terms and verified status.
5. **Express interest:** verified counterparties send an enquiry or invitation; protect player identity/contact details where privacy settings require it.
6. **Open negotiation room:** invite only authorized parties; record offers, counteroffers, comments, versioned terms and timestamps.
7. **Structure transaction:** select the correct sport-specific transaction type; capture fees/consideration, salary/contract terms, instalments, bonuses, sell-on, loan duration/options, trade assets, draft rights, conditions and deadlines as applicable.
8. **Due diligence:** verify identity, club authority, player consent, agent mandate, existing contract constraints, eligibility, sanctions/other legally required screening and competition-specific restrictions.
9. **Document and agree:** exchange controlled documents; capture approvals and signatures using a legally suitable e-signature process where selected; preserve immutable evidence and document versions.
10. **Submit for official clearance:** track required federation/league registration, international transfer certificate, trade approval, roster/waiver clearance or other competition process. TradeMate does not impersonate or replace governing-body systems.
11. **Resolve conditions:** track medical/fitness conditions only through separate, consented restricted channels; resolve work authorization, visas, clearances, registration limits and contractual conditions where applicable.
12. **Confirm outcome:** states include proposed, negotiating, agreed in principle, documents pending, signed, submitted for clearance, approved/registered, rejected, withdrawn, expired, disputed and completed. Exact states vary by sport and transaction.
13. **Close and archive:** provide each authorized party a final record, evidence bundle, obligations/deadlines and audit trail; restrict access according to retention and privacy rules.
14. **Post-transaction:** reminders for instalments/bonuses/options/loan return/renewal/registration deadlines where the platform is authorized to track them; never imply that TradeMate itself moves funds unless a separately approved regulated payment flow exists.

**Three separate truth layers are mandatory:** (a) commercial agreement between parties, (b) contract/document execution, and (c) official league/federation registration or clearance. One must never automatically imply another.

### 5. Exceptional product features

- **Transfer Intelligence:** verified player/club needs matching, explainable recommendations, saved searches, smart shortlists and availability alerts. No opaque or discriminatory ranking.
- **Transfer Centre / live activity:** confirmed moves, official announcements, attributed reports and rumours in visibly separate categories; corrections and source links.
- **Player career passport:** player-controlled sporting history, verified clubs/competitions, contract/registration timeline and portable evidence with granular sharing permissions.
- **Club recruitment workspace:** squad planning, position gaps, recruitment boards, budgets, shortlists, internal notes and multi-user approvals.
- **Agent workspace:** mandate/client management, mandate expiry, authorized opportunities, secure communications and compliance records.
- **Deal room:** structured offers, counteroffers, term comparison, approval routing, version history, secure files and audit events.
- **Transfer fee and contract-term reporting:** disclose only where sourced, licensed and legally shareable; mark estimates and undisclosed values clearly. Never fabricate fees or salaries.
- **Deadline-day command centre:** live window countdown, pending deals, document/approval blockers and personalized alerts.
- **Scouting tools:** structured reports, video links from licensed sources, performance context and private evaluation notes.
- **Localization:** multiple languages, currencies, time zones, date formats and country-specific rule profiles.
- **Accessibility and mobile-first workflows:** low-bandwidth support, resumable uploads, clear status and accessible controls.
- **Reputation and trust signals:** verified identity/authority, transaction conduct and moderated feedback; no unverified public accusations or pay-to-rank.
- **Disputes and incident reporting:** confidential reporting, evidence preservation, escalation, appeals and anti-retaliation controls.
- **Analytics:** club recruitment pipeline and aggregate marketplace trends with privacy safeguards; no sale of sensitive player data.

### 6. Third-party integrations to plan

Maintain provider-neutral adapters and select providers only after technical, legal, coverage, licensing, privacy, cost and reliability evaluation.

- **Governing-body / official rules:** FIFA and member associations for football; FIBA, national federations, NBA, WNBA and other relevant leagues for basketball. Official sources are authorities, not presumed APIs.
- **Football registration:** FIFA TMS and International Transfer Certificate processes where access is authorized; association-specific registration sources and official window notices.
- **Basketball transaction/roster data:** league/federation sources for roster, trade, waiver, free agency, draft and clearance status.
- **Sports data:** evaluate Sportradar and Stats Perform/Opta for competition coverage, player identity matching, historical depth, freshness and redistribution rights.
- **Identity and KYB:** evaluate global KYC/KYB providers from the canonical register; verify players, representatives, club legal entities, directors and beneficial owners proportionately.
- **Agent credentials:** official licensing/registration sources where available, with manual evidence and periodic revalidation where no reliable API exists.
- **Electronic signatures and document integrity:** evaluate legally valid e-signature, signer identity, authority, timestamps, tamper evidence and long-term verification.
- **Secure file and video infrastructure:** private object storage, malware scanning, expiring access, content moderation and licensed video/data suppliers.
- **Communications:** transactional email, optional SMS/voice and in-app notifications with delivery tracking and user preferences.
- **Maps and localization:** geocoding/time-zone data and translation/localization services where useful.
- **Security and risk:** sanctions/PEP screening where legally required, fraud detection, bot protection, security monitoring and independent penetration testing.
- **Calendar and workflow:** calendar export/subscription and reliable event/queue infrastructure for deadline and obligation reminders.

The detailed vendor/source register remains in [third-party-integrations.md](third-party-integrations.md). No provider is selected, contracted or integrated merely by appearing in this roadmap. No scraping, unlicensed redistribution or assumed restricted FIFA/league access.

### 7. Important protections and controls

- **Player autonomy:** player consent is explicit, informed, purpose-specific, time-bounded and revocable; no club or agent can list or negotiate on behalf of a player without verifiable authority.
- **Minors:** age-aware onboarding, guardian verification/consent, restricted discoverability and messaging, no unsolicited direct contact, safeguarding review and jurisdiction/federation-specific rules.
- **Anti-trafficking and exploitation:** detect suspicious recruitment, coercion, document retention, unlawful fees, sham agents and cross-border abuse; provide confidential reporting and specialist escalation.
- **Agent/intermediary safeguards:** verify applicable licensing/authorization, mandate, representation scope, conflicts, expiry and transaction-specific permissions; reflect current rules rather than hardcoding outdated global assumptions.
- **Privacy and data minimization:** protect identity documents, home/contact details, contract terms, salary and sensitive personal data; default to least disclosure and granular permissions.
- **Medical confidentiality:** medical/fitness records are not public profile data; separate storage, explicit purpose and consent, narrow professional access, access logs and deletion/retention controls.
- **Fraud prevention:** detect impersonation, fake clubs, forged mandates, duplicate identities, stolen documents, manipulated videos and suspicious payment requests; use human review and appeals.
- **Financial safety:** no escrow, payment collection, commission settlement or custody claim without a separately approved legal, licensing and payment-provider design. Warn users against off-platform payment fraud.
- **Competition-rule enforcement:** sport-, league-, season- and jurisdiction-aware rules; block or escalate prohibited transactions, eligibility conflicts, roster-limit issues and expired windows.
- **Evidence and audit:** append-only transaction events, versioned documents, timestamps, actor attribution, consent evidence and defensible retention/legal-hold policies.
- **Security:** encryption in transit/at rest, strong authentication, MFA for privileged actors, secure sessions, rate limits, abuse detection, malware scanning, signed webhooks and incident response.
- **Fairness and integrity:** no discriminatory filters or protected-characteristic inference; transparent ranking factors, moderation and appeals; prohibit match-fixing, bribery, collusion and market manipulation.
- **Regulatory and legal review:** country-specific employment, immigration, child protection, privacy, sports-agent, competition, tax and contract law review before enabling relevant workflows.

### 8. TradeMate Sports Transfer experience structure

Keep the feature inside the existing Sports Transfer Contract Category, while giving it a dedicated experience with clear navigation:

1. **Sports Transfer Home:** personalized dashboard, recommended opportunities, saved players/clubs, recent verified activity and action items.
2. **Discover:** browse players, club needs, opportunities, trials and verified recruitment listings; filter by sport and competition.
3. **Transfer Windows:** global Transfer-Window Centre with calendars, countdowns, deadlines, rules and alerts.
4. **Players:** player directory and player-controlled career passports with privacy-aware profiles.
5. **Clubs & Teams:** verified organization directory, squad/recruitment needs and official organization profiles.
6. **Agents & Representatives:** verified professional directory, mandates and authority status.
7. **Transfer Activity:** confirmed transfers, trades and signings; separately labelled reports/rumours with sources.
8. **My Workspace:** role-aware dashboard for players, clubs, agents and scouts; shortlists, recruitment boards, enquiries, offers, negotiations, approvals and documents.
9. **Deal Room:** one secure workspace per transaction with terms, participants, approvals, evidence, deadlines and status.
10. **Notifications & Calendar:** actionable updates, window deadlines, document expiry, pending approvals and reminders.
11. **Trust & Support:** verification status, consent/permissions, safeguarding, report/appeal and dispute support.

The experience must adapt to the signed-in user's verified role without assuming every user is a club or agent. Preserve TradeMate's existing Contract Category submission/review conventions where appropriate, but do not force confidential transfer negotiations or player data into public listing review.



### Transfer-Window Centre implementation specification

The detailed [Global Transfer-Window Centre specification](sports-transfer-window-centre.md) defines sport- and competition-specific calendar dimensions, authoritative source hierarchy, provenance and verification, versioned corrections, timezone-safe storage, confidence labels, alert operations and release gates. It is a design only: no live dates or source integrations are asserted.

### 9. Delivery order and release gates

1. Inspect existing Sports category UI, app.js, API, schema, permissions and migrations; map current data and backward compatibility before renaming implementation identifiers.
2. Design shared sport/competition/season, club/team, player, agent/mandate, consent, verification, document, transaction and audit models.
3. Implement role permissions, privacy boundaries, verification/manual review, safeguarding and sport-specific rule profiles.
4. Build the Transfer-Window Centre with authoritative source attribution and update history.
5. Deliver football transaction workflows and full end-to-end tests.
6. Deliver basketball transaction workflows and full end-to-end tests.
7. Build Deal Room, Transfer Activity, role workspaces, alerts and exceptional features.
8. Integrate licensed/authorized providers after due diligence and acceptance tests.
9. Complete security, privacy, safeguarding, legal, accessibility and abuse-case testing; then staged release and live acceptance.

**Release gate:** no public launch until player consent, minors protections, organization/agent authority, confidential document handling, transaction state separation, auditability, abuse reporting and sport-specific legal/rule review are tested.


## Sports Transfer — guardian relationships and minor safeguarding design

See [`sports-transfer-guardian-safeguarding.md`](sports-transfer-guardian-safeguarding.md) for the mandatory relationship lifecycle, evidence review, narrowly scoped permissions, minor protections, reviewer controls, API requirements and release gates. Existing guardian relationship rows are not proof of legal authority and do not grant access or representation powers. This design is not an implemented or live workflow.


### 10. Global player discovery, listing provenance and account-independent introductions

**Approved product requirement, 17 November 2026:** Sports Transfer is a continuously refreshed global player-discovery network, not merely a directory of players who have manually registered. A player may be discoverable before joining TradeMate, but external discovery never implies player consent, endorsement, representation or authority to negotiate.

#### Listing and discovery entry paths

- **Automatically discovered records:** ingest eligible player identity and market-availability information from contractually licensed sports-data providers, official clubs, leagues, federations/associations, authorized public announcements and other reviewed sources.
- **Player-created opportunities:** a player creates and controls their own opportunity after claiming/creating a private profile and satisfying applicable identity, consent and safeguarding requirements.
- **Representative-created opportunities:** a representative may create or manage an opportunity only after identity, professional status where applicable, mandate evidence, scope, territory, expiry and player consent have been separately verified.
- **Club-created recruitment needs and referrals:** verified sporting organizations can publish recruitment requirements and refer a player through a permitted contact route. A club cannot claim to speak for a player merely because it employs or previously employed them.
- **Claim and correction:** players can securely claim discovered records, resolve duplicate/mismatched identities, correct sporting facts and control which personal information is displayed. Claims must not merge identities without review where confidence is insufficient.

#### Availability provenance and state

- Keep **player identity**, **market availability**, **player consent**, **representative authority**, **contactability**, and **transaction status** as separate data dimensions.
- Label externally sourced records clearly: discovered, source-reported available, availability unverified/conflicting, player-confirmed, representative-confirmed (only within verified mandate), unavailable/withdrawn, stale/expired.
- A source-reported free-agent or transfer-listed status is not a player-confirmed listing. Never display an externally discovered player as endorsing TradeMate or having authorized an agent.
- Store source/provider, source record ID where licensed, evidence/URL where permitted, source type, retrieval time, effective date, confidence, review outcome, last verification, expiry/freshness policy and revision history.
- Reconcile duplicates and conflicting reports; retain provenance and corrections rather than silently overwriting. Do not fabricate missing data or infer free-agent status solely from an expired/unknown contract record.
- Availability monitoring should detect transfers/signings, renewals, loan completion, withdrawal, changed roster status and stale source records. Expire or downgrade stale claims and preserve history.
- Football and basketball availability vocabularies must remain sport-specific: e.g. football transfer-listed, loan-listed, out-of-contract and confirmed free agent; basketball unrestricted/restricted free agency, waivers, trade availability, draft rights and assignments. Do not conflate these statuses.

#### Contact discovery and legitimate source strategy

- Build a **Contact Discovery Engine** separately from player discovery. A sports-data license for identity, statistics or transfer data does not automatically grant access to personal contact data or permission to contact a person.
- Prioritize contacts in this order: (1) player-supplied and verified contacts; (2) player-authorized representative/agency contacts; (3) official club/league/federation business contact channels and introductions; (4) official agent registers and association directories; (5) licensed commercial professional-contact directories under explicit contractual reuse and outreach rights; (6) verified referrals with documented provenance and permission.
- Candidate official sources to evaluate include FIFA's agent directory and national association registers (including The FA where relevant), and the NBPA certified agent directory for NBA representation. These are starting points for professional agent identification, not a universal global player-contact database and not blanket permission to bulk-copy or market to listed individuals.
- Candidate commercial directories to diligence include Footy Contacts for football-industry professional contacts and Passport Hoops for basketball agent contacts. Verify corporate identity, data provenance, geographical/sport coverage, update cadence, accuracy, licensing, API/bulk access, permitted storage, onward use, outreach permissions, deletion obligations and audit rights before procurement or extraction.
- Evaluate Sportradar and Stats Perform/Opta as sports-data candidates for player identity, roster, transfer and market-status coverage. Do not assume either supplies private contact details; require explicit written confirmation of contact-data scope and lawful outreach rights.
- Official club, agency, federation and league websites may supply published professional/business contact routes. Record the page/source and date, distinguish organizational inboxes from personal contacts, and respect site terms and applicable law. Do not scrape behind logins, bypass access controls, evade rate limits or harvest private personal data.
- No provider, directory or source is approved, contracted, integrated or authorized for bulk extraction by this roadmap entry. Maintain a source-by-source permissions register and legal review before ingestion.

#### Contact registry and account-independent notifications

- Maintain a restricted contact registry separate from public player profiles. Store contact subject/owner, channel, source and provenance, verification status/method/time, permitted purpose and lawful basis, consent/preferences where applicable, territory, retention/review date, expiry, suppression/opt-out state and delivery history.
- Apply privacy-by-design and applicable data protection/electronic communications laws. Publicly visible contact information is not automatically permission for recruitment outreach, bulk reuse or resale. Provide notice, purpose limitation, minimization, correction, opt-out/suppression and deletion/retention controls as legally required.
- Build a **Notification & Introduction Engine** with in-app notifications for members and permitted email/SMS/other channels for non-members. Push notifications are for enrolled devices. Messaging channels such as WhatsApp require their own approved business access, consent and policy compliance; they are not assumed available.
- A verified club may express interest in a discoverable player, but the club must not receive private player contact details. TradeMate sends a discreet, purpose-limited invitation only when a permitted contact route and outreach basis exist.
- Account-independent invitations use single-purpose, expiring, revocable, recipient-bound links, appropriate recipient verification, rate limits, anti-enumeration controls, abuse reporting and audit events. A non-member may acknowledge/decline or request an introduction without immediate app installation; identity and authority verification are required before confidential engagement, document access, negotiation or transaction actions.
- Distinguish invitation delivery, delivery failure, recipient verification, response and actual engagement. Never mark a person as notified when delivery is unconfirmed or no valid route exists. Provide fallback/manual introduction workflows without disclosing private details.
- If no legitimate contact route exists, retain the club's interest/shortlist action without claiming the player was contacted. Offer an approved referral/introduction path where possible.
- Agent notifications are permitted only where the agent's identity and professional status (where required) and an active, verified, player-authorized mandate cover the specific purpose, territory and time. An agent directory entry or pending mandate is not authority.
- For minors, contact and notifications must follow verified guardian/safeguarding rules, age-appropriate discoverability, restricted messaging and applicable sport regulations. No unsolicited direct recruitment messaging to minors.

#### User-facing workspaces and controls

- **Player Interest Inbox:** interest requests, invitations, verified club identity, permitted opportunity details, accept/decline/request introduction, report and block.
- **Agent Representation Inbox:** mandate-scoped opportunities and invitations; no representation actions before verification and player authorization.
- **Club Recruitment Workspace:** discover, shortlist, express interest, track invitation/delivery/response status and manage authorized recruitment team access.
- **Contact & Introduction Operations:** internal restricted tooling for source review, provenance, contact verification, bounce/failure, suppression, complaints and manual introductions.
- Clearly label an expression of interest as neither a formal offer nor a signed agreement, and keep it separate from a transfer transaction and official registration/clearance.
- Record actor, organization authority, target player/opportunity, contact-source and permission decision, notification channel, delivery outcome, response and access events in an auditable trail.

#### Provider and delivery procurement candidates

- Transactional email: Amazon SES and Postmark.
- SMS/voice: Twilio and Vonage, subject to destination-country reach, sender registration, deliverability, cost and privacy review.
- Push: Firebase Cloud Messaging and Apple Push Notification service for opted-in registered devices.
- These are candidates only. Compare global reach, country-level delivery, sender requirements, data residency/processing terms, reliability, abuse controls, support, pricing and exit/data-portability before selection. Keep provider-neutral adapters.

#### Delivery sequence and release gates

1. Complete source-by-source contact/data permissions and provider coverage diligence; establish a documented legal basis and source register before importing contact data.
2. Finish private opportunity draft foundation and verify its migration/API tests. PR #168 is merged; its records remain private drafts and are not publicly discoverable.
3. Implement opportunity submission, moderation and publication with player consent, representative mandate, identity/authority, privacy and guardian checks. Keep public profile discovery distinct from confidential opportunity details.
4. Implement external player identity/availability ingestion with source provenance, deduplication, freshness, correction, takedown and stale-data controls; begin with approved sources and non-sensitive sporting facts.
5. Implement restricted contact registry and contact-source verification/permission decision service; do not bulk-import contact details until licensing and lawful outreach are confirmed.
6. Implement club expression-of-interest and player/agent inbox workflows, account-independent secure invitations, notification delivery receipts, opt-out/suppression, rate limiting, abuse reporting and audit events.
7. Add player profile claim, identity resolution, contact verification, agent mandate confirmation and safe onboarding.
8. Complete football and basketball-specific validation, minors safeguarding, privacy/security threat modelling, penetration testing, delivery failure testing, legal review and staged live acceptance.

**Release gate:** no player may be described as personally available/consenting or represented solely because an external source lists them; no private contact details are exposed to clubs; no unverified contact route is treated as a successful notification; no agent receives authority without a verified, active player mandate; no minor is exposed to unapproved direct contact.


---

## Global technology and security standard — mandatory cross-stack roadmap

**Strategic direction:** TradeMate is being built for a global standard. Every stack and subsystem must be selected and engineered for best-in-class security, resilience, performance, scalability, interoperability, privacy, accessibility, observability and maintainability. Choose technologies based on independently supportable capability, threat fit, regional coverage, integration, data residency, lifecycle cost and exit strategy—not familiarity or lowest initial price. Keep provider-neutral interfaces where practical.

This is a roadmap commitment and target architecture, not a claim that products have been purchased, configured, deployed or certified. Vendor names are evaluation candidates only. This entry does not change production configuration, services, secrets, databases, deployments, subscriptions or integrations.

### Governance, standards and assurance
- [ ] Establish a complete asset inventory, data classification, data-flow maps, trust boundaries, threat models and risk register covering web/mobile, APIs, identity, trading/MT5, payments, data, cloud, workforce, CI/CD, vendors and support operations.
- [ ] Adopt NIST Cybersecurity Framework 2.0 for governance; CIS Controls v8.1 for prioritized safeguards; OWASP ASVS Level 2 baseline with selected Level 3 controls for critical trading/admin functions; OWASP API Security Top 10; MITRE ATT&CK; and Zero Trust principles.
- [ ] Establish secure SDLC, privacy impact reviews, security architecture reviews, vulnerability disclosure/response, incident command, tabletop exercises, remediation SLAs and evidence-based release gates.
- [ ] Map applicable financial, privacy, consumer, AML/KYC, sanctions and data-residency obligations by operating jurisdiction with qualified legal/compliance review. Do not claim certification or regulatory approval without independent evidence.

### Edge, firewall, network and API protection
- [ ] Evaluate Cloudflare Enterprise WAAP capabilities (WAF/managed rules, DDoS, bot management, API discovery/protection, rate limiting, abuse controls, client-side security and Zero Trust access) against leading alternatives and measured requirements.
- [ ] Protect every intended public endpoint; prevent direct-origin bypass with restricted ingress and authenticated origin connectivity/mTLS or equivalent where supported.
- [ ] Apply deny-by-default ingress/egress, least-privilege service networking, private data services, strong identity-aware administrative access and strict environment separation.
- [ ] Maintain API inventory/schema contracts; enforce authentication, object/function/property-level authorization, quotas, payload limits, idempotency/replay protection, safe errors and data minimization.
- [ ] Harden registrar/DNS accounts, DNSSEC where supported, TLS/certificate lifecycle, HSTS and certificate-expiry monitoring.
- [ ] Adversarially test DDoS, bot abuse, credential stuffing, scraping, injection, SSRF, request smuggling and origin bypass.

### Identity, phishing, account and privileged-access protection
- [ ] Require phishing-resistant MFA/passkeys or hardware security keys for privileged users and developers; evaluate YubiKey/FIDO2 and equivalent options.
- [ ] Evaluate Microsoft Entra ID or equivalent workforce identity, conditional access, device posture, just-in-time privilege and privileged identity management.
- [ ] Evaluate Proofpoint or equivalent email security for phishing, impersonation/BEC, malicious links and attachments.
- [ ] Enforce SPF, DKIM and DMARC with monitored staged enforcement; protect registrar, DNS, email administration and account recovery channels.
- [ ] Harden customer authentication: strong password hashing, breached-password checks, MFA/passkeys, anti-enumeration, credential-stuffing protection, session rotation/revocation, device/session visibility, risk-based step-up and safe recovery.
- [ ] Require dual control and out-of-band verification for high-impact admin, payout, credential rotation and account-recovery actions. Never rely on email alone for high-impact recovery.
- [ ] Evaluate enterprise password/secrets vaults such as 1Password Business or equivalent; prohibit secrets in source, tickets, logs, chat and build artifacts.

### Endpoint, malware, ransomware and workforce security
- [ ] Evaluate CrowdStrike Falcon against Microsoft Defender XDR/Endpoint and equivalent EDR for endpoint coverage, malware/ransomware prevention, threat hunting, containment, forensic retention, OS support and total cost. Select a coherent primary platform; avoid ungoverned overlapping agents.
- [ ] Require managed-device baselines, disk encryption, secure boot, timely patching, endpoint firewall, EDR health monitoring, least privilege, application control and secure remote access.
- [ ] Protect developer endpoints, CI runners, build agents, support workstations and machines with production/trading credentials.
- [ ] Establish role-specific phishing training, reporting and rapid credential/session revocation.
- [ ] Scan and quarantine uploaded files; isolate risky document/archive processing and never execute untrusted content on application hosts.

### Application, database, data and cryptographic security
- [ ] Complete PostgreSQL least-privilege roles and RLS remediation. Prove identity integrity against caller-settable context, bootstrap access, worker paths, anonymous/pre-session flows and cross-tenant access with adversarial real-PostgreSQL tests. Keep production RLS disabled until design and staged rollout are validated.
- [ ] Classify/minimize sensitive data; encrypt in transit and at rest; separate key management, rotate keys and audit access. Evaluate managed KMS/HSM and envelope encryption for high-value keys.
- [ ] Review password, session, reset, verification, TOTP, API-token, MT5 and provider credential storage; use purpose-specific secrets, least privilege, short lifetimes, rotation and revocation. Never expose broker credentials to browsers or general logs.
- [ ] Enforce ownership/tenant authorization at every sensitive boundary; test horizontal/vertical privilege escalation and IDOR.
- [ ] Defend against SQL/command injection, XSS, CSRF, SSRF, deserialization, path traversal, prototype pollution, race conditions, upload abuse and business-logic fraud.
- [ ] Protect audit records from alteration/deletion; log security-sensitive actions with trusted timestamps, restricted access and privacy-aware retention.
- [ ] Establish DLP/export controls, retention/deletion rules, encrypted immutable/offline backups, restore drills and documented RPO/RTO.
- [ ] Redact passwords, tokens, keys, payment credentials and MT5 secrets from logs, traces, analytics and error reports.

### Trading, MT5 and financial transaction security
- [ ] Threat-model broker/MT5 connectivity, terminal/bridge services, account linking, credential storage, order routing, market data and webhooks.
- [ ] Isolate trading connectors and credentials by user/account/environment; enforce least privilege, encryption, rotation, revocation and broker-side permission limits where available.
- [ ] Enforce server-side order authorization, ownership, trading permissions, exposure/position and order-size limits, market/price validation, idempotency, replay protection, rate limits and circuit breakers.
- [ ] Separate read-only market access from order execution and administrative override privileges; require explicit intent and step-up verification for high-impact actions.
- [ ] Maintain tamper-evident order, risk-check, broker-response and operator audit trails; reconcile internal and broker state and alert on divergence.
- [ ] Build kill switches, safe degradation, duplicate-order prevention, stale-price controls and tested recovery. Fail closed when execution safety cannot be established.
- [ ] Test credential theft, account substitution, order manipulation, replay, duplicate execution, authorization bypass and compromised connectors.

### Cloud, containers, infrastructure and resilience
- [ ] Review Render, Cloudflare and any AWS target under one security baseline; verify live configuration rather than inferring it from repository declarations.
- [ ] Separate dev/test/staging/production identities, projects, networks, secrets, data and deployment permissions.
- [ ] Evaluate cloud security posture/workload protection, private networking, egress controls, audit logs, backup isolation and policy-as-code.
- [ ] Harden containers: minimal pinned images, non-root execution, least capabilities, read-only filesystems where possible, resource limits, image scanning, signatures and provenance.
- [ ] Restrict admin panels, databases, metrics, debug routes and internal services; remove unnecessary public exposure.
- [ ] Define availability, regional failure handling, tested rollback, disaster recovery, capacity controls and resilience exercises. No provider cutover until security, migration, observability and rollback are proven.

### Secure software supply chain and developer workflow
- [ ] Evaluate GitHub Advanced Security/CodeQL or equivalent SAST, secret scanning/push protection, dependency/SCA, license and vulnerability controls.
- [ ] Add container, IaC, workflow and artifact scanning; generate/retain SBOMs and build provenance.
- [ ] Require protected branches, mandatory reviews, signed release provenance, least-privilege CI identities, short-lived OIDC credentials and protected deployment environments.
- [ ] Isolate untrusted PR execution from secrets/privileged runners; pin third-party actions and review workflow permissions.
- [ ] Require deterministic builds, lockfiles, artifact integrity verification and promotion of tested immutable artifacts.
- [ ] Define severity-based vulnerability SLAs, patch windows, exception expiry and emergency response.

### Security operations, threat detection and incident response
- [ ] Evaluate Microsoft Sentinel, Splunk Enterprise Security, Datadog Security Monitoring or equivalent SIEM/security analytics based on coverage, detection quality, response workflows, data residency, scale and cost.
- [ ] Centralize relevant edge, identity, endpoint, cloud, API, database, CI/CD and trading events with synchronized time, restricted access, retention and tamper resistance.
- [ ] Detect account takeover, risky logins, privilege escalation, leaked secrets, unusual database access, API abuse, malware, suspicious deployments, MT5 credential misuse and anomalous trading.
- [ ] Define severity-based alerting, escalation/on-call ownership, evidence preservation and tested containment playbooks.
- [ ] Maintain incident runbooks for ransomware, phishing/BEC, leaked secrets, database/cloud compromise, DDoS, insider threats, supply-chain compromise and trading abuse; exercise them regularly.

### Independent validation and release gates
- [ ] Perform recurring independent penetration tests for perimeter, web/API, identity, cloud, database, trading/MT5 and business logic.
- [ ] Add SAST, SCA, secret scanning, IaC/container scanning, DAST, API tests, fuzzing and adversarial authorization tests to CI/CD where appropriate.
- [ ] Track every finding with evidence, severity, owner, remediation, retest and closure approval.
- [ ] Block releases for unresolved critical/high-risk exploitable findings, broken tenant isolation, exposed secrets, unsafe trading authorization or unproven recovery. Exceptions require documented risk acceptance, compensating controls, owner and expiry.
- [ ] Assess ISO 27001 and SOC 2 readiness when control scope and evidence support it; assess PCI DSS only if actual payment-data scope requires it.

### Technology selection and implementation rules
1. Inventory current controls and threats before procurement; do not buy tools before requirements and gaps are known.
2. Compare leading providers on efficacy, independent evidence, regional coverage, integration, privacy/data residency, resilience, support, contractual terms, portability and lifecycle cost.
3. Choose the best fit per capability; no vendor is presumed best at every layer and more products do not automatically mean more security.
4. Prefer managed capabilities where they demonstrably improve protection and response, while retaining independent controls and tested exit plans.
5. Roll out through design review, isolated proof of concept, adversarial tests, staging validation and controlled production change with rollback.
6. Record decisions, rationale, owner, dependencies, costs, runbooks, evidence and review dates.
7. No production firewall/DNS/identity setting, endpoint agent, database role/policy, secret, vendor subscription, deployment or cutover is changed by this roadmap entry; each requires its own reviewed implementation and authorization.

**Completion criterion:** TradeMate does not claim global security because it uses named products. Material threats must have layered preventive, detective, responsive and recovery controls, tested under realistic adversarial conditions, continuously monitored and independently assessed where appropriate.


## Global technology excellence standard — all stacks

### Objective and governing principle

Establish TradeMate as a globally competitive, best-in-class financial technology platform across **every technology stack and operating discipline**, not security alone. “Best” means demonstrably fit for TradeMate's product, users, markets, regulatory obligations and risk profile—not simply the newest, most expensive or most fashionable technology. The standard applies to existing systems, new capabilities, vendor choices, architecture decisions and future migrations.

This section is a roadmap and evaluation mandate. It does not assert that any capability is already implemented, certified or production-ready. Adding an item here does not authorize a purchase, subscription, migration, production configuration change, deployment, data movement or cutover. Existing production controls and approval requirements remain in force.

### Global decision and engineering standard

For every material stack or platform decision:

1. Inventory the current implementation, versions, dependencies, data flows, owners, operational constraints, technical debt and known risks. Verify repository and deployed state separately; do not assume they match.
2. Define user and business outcomes, workload profiles, target markets, threat model, regulatory constraints, availability needs and measurable acceptance criteria.
3. Benchmark credible leading options, including proven open standards and build-versus-buy alternatives. Use current primary documentation, independent evidence, realistic proof-of-concepts and relevant production references.
4. Compare options consistently across security and privacy, correctness, performance, scalability, reliability, recoverability, interoperability, accessibility, developer productivity, operational maturity, support, regional availability, compliance fit, total cost of ownership, portability and vendor lock-in.
5. Record the decision, alternatives rejected, assumptions, risks, lifecycle costs, exit strategy, owner and review date in an architecture decision record (ADR).
6. Define target architecture and a staged implementation/migration plan with compatibility, rollback, observability, data integrity and operational-readiness requirements.
7. Prove the result with automated tests and representative workload or user validation before release. Define measurable SLOs, SLIs, KPIs, error budgets where appropriate, alerts, dashboards, runbooks and accountable operational ownership.
8. Reassess material decisions periodically and when scale, threat landscape, regulation, vendor lifecycle or product requirements change.

Prefer composable, standards-based and portable designs where they improve resilience and bargaining power. Avoid unnecessary complexity, premature microservices, speculative rewrites and technology churn. Select the simplest architecture that meets the verified global requirements with adequate headroom.

### Technology domains and roadmap requirements

#### 1. Web frontend, product experience and design systems
- Evaluate modern, maintainable frontend architecture, rendering strategy, component systems, state/data-fetching patterns, forms, routing and error handling against actual product needs.
- Set measurable standards for usability, responsive behavior, interaction latency, Core Web Vitals, bundle size, resilience on weak networks and browser/device compatibility.
- Make accessibility a release requirement, targeting WCAG 2.2 AA where applicable; include keyboard, screen-reader, contrast, reduced-motion and localization validation.
- Establish a coherent design system, reusable components, visual regression coverage, product analytics with privacy controls, and consistent loading/empty/error states.

#### 2. Backend architecture, APIs and distributed systems
- Evaluate service boundaries, modularity, synchronous/asynchronous communication, event-driven patterns, queues, idempotency, consistency, retries, timeouts, back-pressure and graceful degradation.
- Standardize API design, versioning, schema contracts, validation, pagination, rate limits, error semantics, authentication/authorization boundaries and machine-readable documentation.
- Require explicit capacity models, latency budgets, concurrency limits, dependency isolation and safe failure behavior for critical workflows.
- Prefer well-defined modular architecture over splitting services without evidence that independent scaling, deployment or ownership justifies the added distributed-systems cost.

#### 3. Databases, storage and data engineering
- Assess relational and other storage technologies against transactional correctness, query patterns, growth, durability, consistency, availability, recovery objectives, encryption, access control and operational burden.
- Establish schema/migration governance, indexing and query-performance budgets, connection-pool limits, backup/restore drills, point-in-time recovery validation, retention and archival policies.
- Define data ownership, lineage, quality checks, classification, minimization, retention, deletion, auditability and controlled access across operational and analytical data.
- For streaming, caching, search and analytical platforms, validate ordering, replay, deduplication, freshness, failure recovery and source-of-truth rules.
- Require representative load tests and restore evidence; a successful backup job or restore exit code alone is not proof of recoverability or data equivalence.

#### 4. Trading, market data, broker and MT5 infrastructure
- Treat trading and execution systems as safety-critical financial workflows. Define explicit boundaries between signal generation, risk checks, order management, broker connectivity, execution, reconciliation and portfolio/account state.
- Evaluate market-data quality, provenance, timestamps, clock synchronization, stale/out-of-order detection, symbol mapping, session calendars, corporate actions where relevant and feed failover.
- Specify order lifecycle state machines, idempotent submission, duplicate prevention, partial fills, rejects, timeouts, reconnect behavior, reconciliation and deterministic audit trails.
- Require pre-trade and runtime risk controls, exposure/position limits, kill switches, market/session safeguards, strategy isolation and fail-closed behavior where appropriate.
- Validate MT5 terminal/manager or broker integrations with contract tests, sandbox/demo environments, failure injection and reconciliation tests. Never infer broker execution guarantees from a successful API response alone.
- Separate research/backtesting from live execution; address look-ahead and survivorship bias, realistic spreads/slippage/fees, latency assumptions, reproducibility and independent strategy validation.
- No live-trading enablement, broker cutover or changes to production execution/risk settings without explicit authorization and completed release gates.

#### 5. AI, machine learning and quantitative intelligence
- Establish a governed model lifecycle covering data provenance, consent and rights, feature/label quality, reproducibility, evaluation, versioning, deployment, monitoring, rollback and retirement.
- Benchmark models against task-specific baselines and out-of-sample datasets; measure calibration, robustness, drift, latency, cost and failure modes—not headline accuracy alone.
- Apply human oversight and explicit permission boundaries to consequential financial actions. Models must not bypass authorization, risk limits, suitability rules or deterministic controls.
- Evaluate prompt injection, data leakage, model supply-chain risk, insecure tool use, privacy, explainability and abuse resistance for AI-enabled features.
- Keep model outputs distinguishable from verified facts; provide audit records and safe fallback behavior. Do not introduce autonomous live trading or other high-impact automation without separately approved controls and validation.

#### 6. Cloud, infrastructure, networking and compute
- Compare cloud and hosting architectures for regional coverage, service maturity, resilience, latency, security controls, support, compliance, portability and full lifecycle cost.
- Standardize infrastructure as code, immutable/repeatable environments, least-privilege identities, network segmentation, private connectivity where appropriate, managed secrets and controlled configuration.
- Define container/runtime standards, resource requests and limits, patching, image provenance, artifact retention, autoscaling and capacity planning.
- Design for regional failure and dependency outages where business impact warrants it; document data residency, cross-region replication and recovery trade-offs.
- Avoid provider-specific commitments without an explicit portability and exit assessment. No cloud migration or production infrastructure change is authorized by this roadmap entry.

#### 7. Mobile and cross-platform applications
- Determine native, cross-platform or progressive-web approaches from user needs, device capabilities, security, performance, accessibility and maintenance cost.
- Define secure local storage, session lifecycle, device compromise considerations, network trust, offline behavior, push-notification privacy and app update strategy.
- Establish supported OS/device matrices, crash-free and startup targets, accessibility checks, automated device testing and release-channel controls.

#### 8. Integrations and interoperability
- Maintain an inventory and ownership map for payment, identity, market-data, broker, email, messaging, analytics and other third-party integrations.
- Require documented contracts, scoped credentials, rotation, rate-limit handling, retries, idempotency, webhook signature validation, replay protection, timeouts and circuit breakers.
- Assess vendor resilience, incident history, support SLAs, data processing terms, geographic availability, regulatory fit, exit rights and substitution cost.
- Prefer open protocols and stable interfaces; isolate vendor-specific logic behind adapters and test contract compatibility continuously.

#### 9. DevOps, platform engineering and release engineering
- Improve reproducible builds, dependency management, CI/CD integrity, artifact signing/provenance, environment parity, deployment safety and rollback.
- Standardize infrastructure and application configuration, secret injection, policy-as-code, branch protections, review requirements and auditable change approvals.
- Evaluate progressive delivery (feature flags, canaries and controlled rollouts) according to service criticality and available telemetry.
- Establish developer self-service and paved paths without weakening security, auditability or production controls.

#### 10. Testing, quality and performance engineering
- Define a risk-based quality strategy spanning unit, component, integration, contract, end-to-end, migration, accessibility, security, load, stress, soak, resilience and recovery testing.
- Require tests for critical financial invariants, authorization boundaries, concurrency, idempotency, rounding/precision, time zones, market sessions and failure recovery.
- Use representative datasets and workload profiles; establish performance budgets and regression thresholds for critical user and trading paths.
- Use fault injection and chaos experiments only in controlled, authorized environments with blast-radius limits and abort criteria.
- Treat flaky tests, skipped checks and unverified manual steps as tracked quality risks, not successful evidence.

#### 11. Observability, analytics and operational intelligence
- Establish structured, correlated logs, metrics and distributed traces with consistent service, environment and request identifiers.
- Define actionable dashboards, alert thresholds, on-call ownership, incident severity, escalation paths and runbooks for critical services.
- Measure user experience, API latency/error rates, data freshness, market-feed health, order lifecycle health, database saturation, queue lag, infrastructure cost and recovery performance.
- Apply privacy-aware telemetry, data minimization, access controls and retention limits; never log credentials, session tokens or sensitive financial data unnecessarily.
- Use analytics and experimentation with clear event definitions, data quality checks and safeguards against misleading metrics.

#### 12. Security, identity and privacy
- Apply the detailed **Global technology and security standard — mandatory cross-stack roadmap** section in this roadmap as the security baseline for every domain.
- Integrate secure-by-design threat modeling, identity and access management, privacy engineering, encryption, secure SDLC, supply-chain controls, vulnerability management, incident response and independent assurance throughout architecture and delivery.
- Security and privacy are release gates, not optional specialist add-ons. Do not duplicate the detailed security workstream; maintain traceability between domain-specific work and its controls.

#### 13. Reliability, resilience and business continuity
- Classify services and workflows by criticality; define service-level objectives, availability targets, latency targets, recovery time objectives (RTOs) and recovery point objectives (RPOs).
- Design and test graceful degradation, dependency isolation, queue recovery, failover, backups, restore, disaster recovery and business continuity.
- Ensure critical trading, account, payment and identity workflows have explicit safe-state behavior and operational ownership.
- Conduct periodic recovery exercises and record evidence, gaps, remediation owners and completion dates.

#### 14. Compliance, localization and global readiness
- Maintain a jurisdiction and product-feature matrix covering applicable financial-services, privacy, consumer-protection, records, accessibility, tax and data-residency obligations, with qualified legal/compliance review.
- Design for localization of language, number/date formats, currencies, time zones, calendars, regional payment methods and market trading sessions.
- Define controls for data subject rights, consent, retention, export, deletion, audit records and cross-border transfers where applicable.
- Do not claim regulatory approval, certification or legal compliance solely from technical implementation; require documented assessment by qualified owners.

#### 15. Developer experience, architecture governance and maintainability
- Establish coding standards, type safety, linting/formatting, documentation, dependency hygiene, code ownership and review expectations across repositories.
- Track complexity, duplication, dependency health, technical debt, maintainability and upgrade lifecycle; prioritize remediation by risk and business impact.
- Maintain architecture diagrams, data-flow diagrams, service catalogues, ADRs, ownership records and operational documentation.
- Evaluate developer tooling by measurable improvements in delivery quality, cycle time and reliability while protecting source code and sensitive data.
- Defer broad file/folder restructuring and large-scale code movement until the designated end-of-roadmap cleanup phase, unless a specific safety or correctness issue requires earlier targeted action.

### Global acceptance gates

A material technology initiative is not complete until its owner can demonstrate:

- A verified current-state inventory and documented problem statement.
- An approved ADR and target architecture, including alternatives, risks, cost and exit strategy.
- Security, privacy, compliance and data-governance review appropriate to the system's risk.
- Automated functional, integration, contract and relevant non-functional tests with recorded evidence.
- Measured performance, capacity and reliability against agreed targets using representative conditions.
- Monitoring, alerts, runbooks, support ownership, backup/recovery and incident procedures appropriate to criticality.
- A staged rollout and rollback plan, compatibility assessment and explicit authorization for any production-impacting action.
- Updated technical documentation, service ownership and a scheduled reassessment date.

### Delivery sequence and controls

1. **Discover and baseline:** inventory all stacks, services, integrations, versions, owners, data flows, costs, SLOs and known gaps.
2. **Prioritize:** rank work by user impact, financial/trading risk, security/privacy exposure, reliability, regulatory urgency, scale constraints and cost of delay.
3. **Set target standards:** publish domain-specific reference architectures, engineering standards, decision records and measurable quality gates.
4. **Prove before adopting:** run isolated prototypes and benchmarks; validate migration, portability, vendor exit and operational assumptions.
5. **Implement incrementally:** sequence low-risk foundations before dependent migrations; preserve compatibility and provide rollback.
6. **Verify and operate:** collect acceptance evidence, establish operational ownership and monitor real outcomes.
7. **Continuously improve:** review architecture, technology lifecycle, incidents, costs, performance and market-leading alternatives on a defined cadence.

The technology inventory, baseline and prioritization are prerequisites to selecting specific upgrades. Vendor and product names in other roadmap material are evaluation candidates only unless a separate decision record and approval explicitly select them. No tool purchase, vendor commitment, production change, deployment, merge, infrastructure migration, database change or trading cutover is authorized merely by this roadmap section.


## Implementation register — evidence and production acceptance governance

The canonical cross-stack implementation register is `TradeMate-main/docs/implementation-register.md`. Keep it synchronized with repository changes and independently verified deployed/production behavior. This register is an evidence ledger, not a progress estimate or a declaration of certification.

### Status definitions

- **Implemented (repository):** code/configuration exists on the tracked branch and has been reviewed; required automated checks pass. This status alone does not mean production acceptance.
- **Partially implemented:** only a subset, prototype, foundation or non-production capability exists, or required tests/operational controls remain outstanding.
- **Production accepted:** the exact deployed version/configuration has been identified and production acceptance evidence is recorded, including successful relevant end-to-end checks, operational telemetry, security/privacy review, rollback/recovery readiness and accountable owner approval.
- **Not implemented:** no qualifying implementation evidence exists.
- **Unverified:** evidence is insufficient, stale, contradictory or unavailable. Do not convert unverified to implemented by inference.

### Evidence required for every status change

1. Record the repository path(s), commit SHA and concise implementation description.
2. Link the automated test/workflow run and record its final conclusion. A skipped, cancelled, queued or merely started job is not a pass.
3. For production acceptance, identify the deployed release/version and environment, deployment evidence, production-safe acceptance result, observed SLO/SLI evidence where applicable, and named accountable approval. Do not expose secrets or sensitive customer data.
4. Record known gaps, dependencies, risks, owner and next verification date.
5. Re-check affected rows whenever code, dependencies, infrastructure, provider behavior, architecture or production configuration changes. Downgrade status when evidence expires or a regression is found.

### Non-negotiable reporting rules

- Never tick an entire technology domain because one library, service, endpoint or prototype exists.
- Separate repository implementation, CI verification, staging validation and production acceptance; they are different gates.
- Never infer production state from source code, a successful build, a deployment request, a database restore exit code or a vendor feature list.
- A test pass applies only to the tested commit, configuration, environment and scope.
- Keep evidence links and timestamps with the row; do not claim certification or regulatory compliance without independent, applicable evidence.
- Update the register in the same change as material implementation work, or immediately after the evidence becomes available.
- Preserve the agreed constraint that broad file/folder restructuring occurs at the end of the roadmap, except for a narrowly justified safety/correctness fix.
- Register maintenance does not authorize production changes, deployments, merges, purchases, vendor commitments, data movement or cutovers.
