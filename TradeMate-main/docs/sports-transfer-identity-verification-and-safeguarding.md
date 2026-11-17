# Sports Transfer identity verification and safeguarding architecture

**Status:** Architecture decision record and implementation specification. Sumsub is the initial KYC integration target. The API adapter, Sandbox-ready WebSDK token endpoint, signed webhook verification and status retrieval are implemented in code; no Sumsub account, credentials, commercial agreement, production access or live verification is configured yet. Real Sandbox credential validation, country coverage approval and production approval remain outstanding.

## 1. Purpose and release boundary

Sports Transfer is a global football and basketball marketplace. It must distinguish:
- **Account identity:** who controls a TradeMate account.
- **Legal identity assurance (KYC):** whether a person is the real-world individual they claim to be, at a risk-appropriate assurance level.
- **Sporting identity:** whether that person is the player represented by a particular club, competition, federation, or independently corroborated sporting record.
- **Authority:** whether a person may act for a player, club, academy, or other organisation, including the exact mandate, territory, sport, scope, and validity period.
- **Safeguarding eligibility:** whether the requested interaction is permitted given age, guardian authority, consent, and applicable rules.

These are separate decisions and must never be collapsed into one generic `verified` flag. A successful KYC check does not prove a sporting identity, agent authority, club employment, or guardian authority. A league roster match does not prove legal identity.

Until the required gates are implemented and independently tested, external discovery records remain restricted, player claims remain moderation-only, and opportunities must not become publicly discoverable.

## 2. Provider strategy

Use a provider-neutral adapter and implement Sumsub first for adult legal-identity KYC. Veriff remains a challenger; assess Trulioo for global identity and business verification coverage. Regional providers such as Smile ID and Dojah may supplement coverage where their legal entity, country support, document types, liveness, and assurance are demonstrably better. Sumsub is the engineering integration target, not yet a contracted or production-approved vendor. Country coverage and suitability must be validated before enabling any jurisdiction.

Before contracting, produce a country-by-country coverage matrix for supported player/account countries:
- Supported identity documents and document versions.
- Supported languages, scripts, transliteration and name-order handling.
- Liveness and presentation-attack detection capabilities.
- Face-match availability, limitations, and fallback.
- Sanctions/PEP/adverse-media capabilities and lawful-use limitations.
- Business KYB, directors, UBO and representative coverage.
- Data residency, subprocessors, cross-border transfers, retention and deletion.
- Webhook signature guarantees, event identifiers, retry policy, idempotency and SLA.
- Manual review, appeal, accessibility and non-smartphone alternatives.
- Pricing, support escalation, audit evidence, security certifications and breach terms.

Do not assume one vendor has truly global coverage. Provider selection requires legal/privacy review and measured test coverage, not marketing claims. Do not send sensitive documents to multiple vendors by default; use a controlled fallback only when the first provider cannot support the jurisdiction or document.

## 2A. Initial Sumsub integration boundary

The first adapter uses Sumsub's documented HMAC-SHA256 API request authentication and applicant-bound WebSDK access tokens. A TradeMate account-page flow launches the official client-side WebSDK and supports token refresh. TradeMate uses the internal verification-case UUID as Sumsub's `userId` / `externalUserId`, so the provider callback can be correlated without sending a user's email, phone number, or identity document data in the initial API request.

- Credentials are supplied only through deployment secrets: `SUMSUB_APP_TOKEN`, `SUMSUB_SECRET_KEY`, `SUMSUB_KYC_LEVEL_NAME`, and `SUMSUB_WEBHOOK_SECRET`.
- The Sandbox or Production app-token pair selects the Sumsub environment; never reuse production credentials in tests.
- WebSDK access tokens are short-lived and returned only from the authenticated, owner-checked case-session endpoint. They are not stored in TradeMate's database.
- Sumsub webhook signatures are verified against the original raw body using the configured digest algorithm. The inbox event key is deterministically derived from Sumsub applicant/event metadata because the documented applicant webhook does not expose a universal event ID.
- Webhook retries are idempotent. Provider events only move an open case into TradeMate's human-review queue; a Sumsub GREEN/RED result never directly verifies or rejects a TradeMate identity.
- The owner status endpoint can retrieve current Sumsub review status as a recovery path; webhooks remain the primary delivery mechanism.
- Sumsub's verification-level name must exist in the same environment as the app token. Sandbox configuration and Production configuration are separate.
- The client-side WebSDK screen is implemented but awaits real Sandbox credentials and end-to-end testing. No live identity checks occur until valid credentials, provider configuration, privacy review and country policy are in place.

## 3. Provider adapter contract

Implement an internal interface with operations equivalent to:
- create a verification session for a specific subject and purpose;
- retrieve a provider result using an opaque provider reference;
- verify webhook authenticity before parsing or acting on an event;
- normalize provider events into internal states;
- request cancellation/deletion where supported.

The adapter returns normalized outcomes, not raw identity documents. Provider-specific SDKs, tokens, payloads and webhook formats stay behind the adapter. Never expose provider secrets or session tokens in client-visible API responses or logs.

Persist provider name, provider subject reference, internal verification case ID, purpose, country, policy/version, timestamps, normalized status, reason codes, and minimal decision metadata. Do not persist raw document images, full document numbers, biometric templates, or unnecessary provider payloads in ordinary application tables.

## 4. Verification state model

Maintain separate cases and state machines.

### Account/legal identity
`not_started → session_created → submitted → processing → verified | needs_review | rejected | expired | cancelled`

### Sporting identity
`unverified → evidence_submitted → corroboration_pending → verified | needs_review | rejected | disputed | expired`

### Organisation KYB and role authority
`not_started → submitted → processing → verified | needs_review | rejected | expired`

A verified organisation does not automatically verify a user as its director, recruiter, agent, or authorised signatory. Verify the person's role and authority separately.

### Guardian authority
`not_started → relationship_evidence_submitted → review_pending → verified | rejected | expired | revoked`

Every state change records actor, timestamp, policy version, reason code, and audit correlation ID. Re-verification can be triggered by expiry, material profile changes, risk signals, disputes, or provider revocation. A prior approval must not silently survive a material change.

## 5. Sporting identity evidence and review

Use a hierarchy of evidence, not a single source:
1. Direct confirmation from an official club, league, federation, school/university, or competition contact using independently verified institutional contact channels.
2. Official roster, registration, match sheet, competition record, or club announcement with provenance and effective date.
3. A combination of corroborating reputable sources where no authoritative record exists.
4. Human specialist review for conflicting, incomplete, youth, amateur, women’s, lower-division, cross-border, transliterated, or historical records.

Capture the source, URL or secure evidence reference, date checked, jurisdiction, data rights, reviewer, and confidence rationale. A public profile, social-media account, agent assertion, or uploaded image alone is not sufficient. Automated matching may rank candidates for review but must not approve, merge, or expose a player record without the required human decision.

Provide a correction/dispute route for players and clubs. Preserve source provenance and previous decisions; do not overwrite a disputed identity trail.

## 6. Minors and safeguarding

Treat age as a safeguarding attribute, not a marketing filter. Establish the applicable age threshold and legal rules by country, sport, competition and interaction type with counsel before enabling minors' workflows.

Minimum controls:
- Establish age with proportionate evidence and do not expose date of birth publicly.
- Verify guardian identity and legal authority independently; a claimed family relationship is insufficient.
- Record guardian relationship, scope, jurisdiction, evidence reference, verification method, expiry and revocation.
- Require explicit, purpose-specific guardian consent where legally required, alongside the young person's assent where appropriate.
- Restrict discoverability, profile fields, direct messaging, contact disclosure, negotiation, document sharing and notifications according to age and local rules.
- No unsolicited direct contact to a minor. Route permitted communications through verified guardian or approved club/academy safeguarding channels.
- Do not permit an agent mandate to bypass guardian controls.
- Provide safeguarding escalation, report/block, case handling, restricted staff access and documented response timelines.
- Default to no public discovery or direct outreach where age or guardian status is unknown, inconsistent or disputed.

Do not collect unnecessary medical, school, home-address, precise-location or family data. Medical information, if ever supported, requires a separate explicit consent and access boundary; it is not part of general identity verification.

## 7. Representative and club authority

A representative mandate must be independently verified and scoped by:
- player and representative identities;
- sport and (where relevant) gender/category;
- territory and permitted activities;
- effective and expiry dates;
- exclusivity, if any, and conflict declarations;
- source evidence and verification outcome;
- player consent and guardian approval where applicable.

An agent licence, agency membership, business registration, or platform membership does not itself prove a mandate. Verify licence status where required, but separately verify that the player authorised this representative for this mandate.

For clubs, verify legal entity, competition/association affiliation where applicable, and the user's specific role and authority. Apply least privilege and re-check authority for sensitive actions.

## 8. Consent and publication gates

Before an opportunity can be submitted for review or published, evaluate all applicable gates server-side:
- account session active and legal identity assurance current at required level;
- sporting identity verified for player-owned opportunities;
- organisation KYB and actor authority verified for club-owned opportunities;
- representative mandate current and within scope when an agent acts;
- purpose-specific consent active and unexpired;
- guardian relationship/consent and age-specific restrictions satisfied;
- source rights and data-purpose permissions valid;
- moderation decision approved;
- no unresolved identity dispute, safeguarding hold, suspension or legal restriction.

Draft creation may remain private and clearly labelled incomplete. Submission/publication must fail closed with actionable, non-sensitive reason codes. Never rely on client-side checks alone.

Consent is purpose-specific, time-limited, revocable, and versioned. Revocation stops future processing/outreach where applicable; it does not erase legally required audit records. Record consent text/version, purposes, recipient classes, expiry, withdrawal and actor.

## 9. Webhook and security requirements

- Verify provider signatures against the raw request body before parsing; reject invalid signatures.
- Enforce timestamp tolerance and replay protection where provider supports it.
- Persist provider event IDs with a unique constraint; process idempotently.
- Use an inbox/outbox or durable queue so transient failures do not lose state changes.
- Handle out-of-order events using provider sequence/version or a safe fetch-current-result reconciliation.
- Never let a webhook downgrade a stronger state without an explicit, audited policy.
- Keep secrets in managed secret storage; rotate and scope them.
- Rate-limit session creation and sensitive endpoints; detect account enumeration and abuse.
- Separate reviewer permissions from provider webhook credentials.
- Log correlation IDs and normalized reason codes only; redact document numbers, tokens, biometrics and raw payloads.
- Encrypt evidence references and any retained sensitive data; use restricted, audited access and defined deletion schedules.
- Test signature failures, replay, duplicate delivery, out-of-order events, provider outage, retries, deletion, and manual escalation.

## 10. Appeals, errors and human review

Provide a clear route to challenge false rejection, incorrect name transliteration, inaccessible documents, duplicate identities, mistaken age assessment, or disputed sporting records. Show users the next action and expected review stage without exposing fraud rules or reviewer-sensitive information.

Reviewers must see only the minimum evidence needed for their task. High-risk decisions require separation of duties or a second reviewer. All overrides require a reason and immutable audit trail. Do not make adverse decisions solely from opaque automated risk scores.

## 11. Data retention and privacy

Create a retention schedule by data class and jurisdiction before provider launch. Prefer provider-hosted document capture and store only opaque references and normalized outcomes. Retain evidence only as long as necessary for the stated purpose, legal obligations, dispute windows, and safeguarding requirements. Support access, correction, deletion and restriction requests subject to applicable legal retention. Record deletion requests and provider acknowledgements.

Complete a privacy impact assessment, threat model, data-flow map, vendor due diligence, cross-border transfer assessment and incident-response playbook before production use.

## 12. Delivery sequence and acceptance criteria

### Phase A — internal foundation
- Schema for separate legal identity, sporting identity, KYB/role, guardian and mandate cases.
- Provider-neutral adapter contract and sandbox implementation.
- Signed, idempotent webhook inbox and normalized event processor.
- Audit, retention metadata, reviewer roles and reason codes.
- No public discovery or automatic approval.

### Phase B — adult account verification pilot
- One selected provider only after due diligence and country coverage review.
- Adult-only pilot in explicitly supported jurisdictions.
- Session creation, status polling/webhook, manual review, retry, appeal and deletion.
- Negative tests for forged webhook, replay, duplicate/out-of-order events, expired sessions and provider outage.

### Phase C — sporting identity and authority
- Independent club/league evidence workflow.
- Human review, dispute/correction, verified organisation roles and representative mandates.
- Only after legal identity and sporting identity are separate and auditable.

### Phase D — minors and publication
- Country/sport-specific safeguarding rules approved by counsel and safeguarding lead.
- Verified guardian workflow, assent/consent, restricted communications and escalation.
- Server-side opportunity submission/publication gates and extensive abuse tests.
- Public discovery only after all source-rights, privacy, identity, consent, safeguarding and moderation gates pass.

### Release acceptance
- No single generic verification flag authorizes all capabilities.
- No raw identity documents or biometric data in ordinary tables/logs.
- Every state transition is attributable and auditable.
- Webhook processing is signed, replay-safe and idempotent.
- No player identity link is made by automated matching alone.
- Unverified, disputed, expired, minor/guardian-unknown or revoked cases fail closed.
- No public discovery or direct outreach is enabled by this architecture document alone.

## 13. Explicit non-goals

This specification does not select or contract a vendor, assert global provider coverage, implement KYC/KYB, establish legal age thresholds, create guardian consent, approve any player identity, or authorize public player discovery. Those require implementation, testing, and legal/safeguarding approval.
