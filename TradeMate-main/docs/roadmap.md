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
- **Validation:** the latest working-branch commit passed the web build, `node --check` for the served app script, API TypeScript build and clean PostgreSQL migration integration job. Live end-to-end and mobile testing remain outstanding.
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

- **Already present in current source:** organization profile-name update API; transactional organization-document upload; organization document ID validation.
- **Already present in current main (correction to the November 1 audit):** authenticated password change is implemented at `POST /auth/change-password`, with schema validation, current-password verification, session revocation and audit logging; the UI action is connected. The password inputs were not masked; this branch changes them to password inputs with appropriate autocomplete hints.
- **Feed mismatch confirmed on current main and corrected on this branch:** the composer treats the title as optional, while the API schema/controller required a non-empty title. The schema and controller now accept an omitted or empty title while retaining the 140-character maximum.
- **Session defects confirmed on current main and corrected on this branch:** connected logout now waits for server confirmation before clearing local state; session bootstrap now clears the session only on HTTP 401 and preserves cached state on transient network/API failures with a visible warning.
- **Reliability defect confirmed:** `loadMarket`, `loadMine`, `loadOrg`, `loadContracts`, `loadContractMessages`, `loadEnquiries` and `loadMsgs` swallow errors. Replace silent failure with explicit, recoverable loading/error states and retry actions.
- **Historical audit items requiring fresh verification:** account profile fields/photos, follow/highlight workflows, organization image upload, OAuth/account linking, password reset, KYC, wallet/ledger, support/feedback/notification paths, promotion/referral workflows, Real Estate/Software contract coverage and local-only preferences. Do not assume the November 1 audit remains current; several backend connections have since been added.

### Next execution order

1. Complete review and CI/security verification of PR #79; merge only after explicit product-owner approval.
2. Add recoverable states/retry handling for the silent core loaders, without changing established marketplace/NFT layout dimensions.
3. Verify organization document transaction semantics and permissions with integration tests.
4. Run the Services/B2B and contract lifecycle two-account acceptance matrix.
5. Complete Feed/mobile and Forex/Crypto/NFT production acceptance checks.
6. Continue the S1 security gates in parallel, without enabling production RLS until role/context/pool-reuse tests pass.

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
