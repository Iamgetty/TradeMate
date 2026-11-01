# TradeMate roadmap

This roadmap records the current product direction. It is not a claim that each item is already implemented or deployed.

## Current product principles

- TradeMate connects counterparties; it is not a conventional exchange or product checkout.
- The core outcome is a mutually agreed business contract.
- Current marketplace categories include Services and B2B, alongside Real Estate, Software, NFTs and market-information sections.
- Product listings and product-cart commerce are out of scope for the current build. A dedicated product marketplace may be reconsidered in a future version, subject to a deliberate product decision. It must not silently reappear in the current app.
- Keep P2P separate from the current marketplace contract workflow.

## Current implementation snapshot

The following work is present on the working branch only; it has not been deployed to production.

- **Product removal:** current Product category, product-cart UI and conventional marketplace transaction writes have been removed. Migration `009` converts legacy Product listing records to the explicit B2B type; historical migration files remain unchanged for reproducible database history.
- **B2B:** API and database now use `b2b` as a distinct listing type rather than reusing `product`.
- **Contracts:** persistent Services/B2B proposals, seller acceptance/decline, buyer cancellation, contract messages and dual fulfilment confirmation are implemented in the initial API/UI flow. No payment, escrow or e-signature is included. End-to-end QA remains.
- **Feed:** required title, file attachments, voice-note recording, inline audio playback and image previews are implemented. Mobile-device and failure-state QA remains.
- **Public profiles:** migration `019` has been applied to the live database (Database migrations workflow run 44 passed). Authenticated profile read/update endpoints, follow/unfollow endpoints, follow/unfollow audit events and frontend persistence for bio, social links, profile/cover photos and highlights are implemented. Feed responses expose author IDs and profile links now resolve by stable user ID. CI verifies the API build, web build/runtime syntax and clean-database migrations. Live end-to-end verification across two accounts and photo object-storage migration remain outstanding.
- **Forex:** ten instruments are defined in each of the four requested groups, with a public quote route and no OANDA credentials. Live provider availability still needs verification.
- **Clients/Alpha modes:** the user-facing modes are Clients and Alpha; both have a Contracts view, while enquiries remain a separate Conversations view. Internal Buyer/Seller role values remain unchanged for compatibility. Permission and full workflow QA remains.
- **Validation:** the latest working-branch commit passed the web build, `node --check` for the served app script, API TypeScript build and clean PostgreSQL migration integration job. Live end-to-end and mobile testing remain outstanding.
- **Documents:** no litepaper or white paper source files were found in the available TradeMate repositories. The future Product consideration is recorded here and in the README; the original documents are needed before updating them.

## Pre-P2P completion

1. Remove legacy Product UI, API paths and terminology; retain B2B as its own marketplace offer type.
2. Complete B2B and Services publishing, discovery, review and counterparty flows.
3. Complete end-to-end QA of the initial contract proposal, review, acceptance/rejection, cancellation and mutual fulfilment confirmation flow; extend it consistently across supported market categories and remove all remaining conventional buy/sell/order/bid checkout paths.
4. Make Clients mode and Alpha mode reflect the same durable contract records and permissions without changing internal role permissions or historical records.
5. Complete Feed post titles, file attachments and voice notes, including playback/download and mobile failure states.
6. Verify Forex market groups and public quote availability for the requested top-ten indices, commodities, equities and bonds/treasuries.
7. Audit every tab, detail view, form, filter, menu, responsive layout, authorization boundary and performance hotspot.
8. Update the litepaper and white paper once their source documents are available in the repository.

## Later-stage P2P

P2P work begins only after the pre-P2P requirements are verified and the product owner has supplied the remaining instructions. Any live crypto trading, escrow, custody or payment feature requires jurisdiction-specific legal/compliance review, provider approval, threat modelling and independent security testing.

## Future consideration: Product marketplace

A product marketplace is a possible future feature only. It is not part of the current scope and should not be included in current navigation, search, publishing, checkout or contract flows unless explicitly approved in a future product decision.

## Security, trust and compliance programme

This programme is part of the committed TradeMate roadmap. Every item below is planned work, not a claim of current implementation. Security work must be completed and verified in stages; do not enable database policies or financial controls in a way that locks out legitimate application workflows.

### Phase S1 — Secure development foundations

1. Adopt and document the NIST Secure Software Development Framework (SSDF), with ownership, evidence and release criteria.
2. Enable full TypeScript strict mode incrementally and resolve all resulting type errors; retain no implicit escape hatches without documented justification.
3. Adopt Zod schemas for API request bodies, query parameters, route parameters and important environment configuration; validate at trust boundaries.
4. Design separate least-privilege database roles for migrations, application runtime and read-only/background workloads.
5. Implement PostgreSQL Row-Level Security on sensitive tables, including FORCE ROW LEVEL SECURITY where appropriate. Define transaction-scoped user/tenant context and test connection-pool isolation before enabling policies.
6. Add mandatory CI security gates: Semgrep SAST, dependency/SCA scanning and secret scanning (for example GitGuardian or TruffleHog), with documented triage and exception expiry.
7. Add a security-focused pull-request checklist and review requirements.

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

