# TradeMate Africa Verification Architecture

**Status:** implementation baseline and decision record  
**Initial country:** Nigeria  
**Target architecture:** country-configurable across African and other supported markets  
**Provider selection:** no new provider contract or production enablement is implied by this document.

## 1. Objective and boundaries

Build a unified trust and due-diligence capability for TradeMate while keeping each subject and legal purpose distinct:

- **KYC:** natural-person identity. The subject is a TradeMate user or another natural person whose identity must be established for a business relationship.
- **KYB:** legal-entity existence, registration, operating status, ownership/control and authority to act. The subject is an organization.
- **Person checks within KYB:** directors, beneficial owners, controllers and authorized representatives are people. A KYB approval does not automatically verify any of those people; a person's KYC approval does not prove their authority to represent a company.
- **Other checks:** sanctions/PEP/adverse-media screening, fraud signals, phone/email/address checks, payment-account ownership and ongoing monitoring are separate, purpose-bound checks. They must not be silently represented as identity verification.

This system is a marketplace trust capability. It does not by itself authorize TradeMate to provide regulated financial services, custody, escrow, payments, securities, derivatives or money transmission.

## 2. Existing TradeMate foundation — reuse, do not duplicate

The API already contains an individual Persona inquiry flow:

- authenticated agreement retrieval and explicit acceptance;
- typed-name agreement evidence stored in the private document vault;
- authenticated Persona inquiry creation/resumption;
- one-time hosted inquiry links;
- signed webhook verification and idempotent event receipts;
- inquiry-to-user mapping and status reconciliation;
- private verification event evidence records.

The current KYC status endpoint maps Persona approval to `verified: true`; submission/completion alone is not approval. Existing KYC work must be audited and production-accepted, not rewritten as a second KYC stack.

The repository also has organization creation, organization documents, organization review and a private document vault. Those functions currently do **not** establish a complete KYB result. In particular, ordinary organization moderation/activation must not be treated as proof of legal registration, beneficial ownership or representative authority.

The Persona hosted-template design PR is a separate design task. It does not prove that the Persona Dashboard template is configured or deployed to Production.

## 3. Service boundaries

### 3.1 Verification orchestration

Create a provider-neutral verification domain with:

- a verification case linked to exactly one subject and one purpose;
- country, entity type, risk tier, policy version and required-check snapshot;
- provider adapter selection and provider correlation IDs;
- normalized check outcomes with provider provenance;
- immutable event/audit history;
- human-review and appeal states;
- expiry, periodic refresh and change-triggered re-verification;
- idempotent provider webhooks and reconciliation jobs.

Provider-specific payloads and secrets stay inside adapters. The application stores only the minimum normalized outcome and references needed for audit and support.

### 3.2 Subject separation

Use separate KYC and KYB records even when they share a workflow engine.

- A user has an individual KYC status.
- An organization has a KYB status.
- Organization people have their own identity/role checks and links to their own TradeMate account only where that relationship is authenticated and verified.
- Never infer a person's identity or authority from an organization document.
- Never expose document images, raw identity numbers, screening details or reviewer notes in public profiles or marketplace APIs.

### 3.3 Normalized lifecycle

Recommended common case states:

`not_started → draft → submitted → pending → in_review → approved | rejected | needs_information | expired`

Provider-specific statuses are retained as provenance and mapped conservatively. A provider's `completed` event means the inquiry is complete, not necessarily approved. A decline, review flag, timeout or missing provider response must not be converted to approval.

KYB additionally records separate outcomes for:
- legal existence and current registry status;
- legal name and registration-number match;
- entity type and jurisdiction;
- registered/principal address;
- directors and authorized signatories;
- beneficial ownership/control;
- document authenticity and consistency;
- sanctions/PEP/adverse-media results where lawfully required;
- risk decision and manual-review rationale.

A case can be approved only when the country policy's required checks have acceptable outcomes and any required human review is complete.

## 4. Country policy model

Country-specific rules must be versioned configuration/data, not scattered conditionals in controllers.

Each country profile must define:
- ISO country code, supported entity forms and registry authority;
- accepted registration evidence and official lookup source;
- available electronic registry/API checks and their authorization prerequisites;
- acceptable manual/document fallback when no reliable API exists;
- required representative, director and beneficial-owner declarations;
- beneficial ownership/control thresholds and aggregation rules, sourced to applicable law and the actual TradeMate risk model;
- accepted identity methods and documents for residents/non-residents;
- sanctions/PEP/adverse-media scope and escalation rules;
- risk tiers, enhanced due-diligence triggers and review intervals;
- privacy notice, lawful basis/consent requirements, retention and cross-border transfer controls;
- policy owner, legal review date, effective date and source references.

No global ownership threshold or one-document rule is to be hard-coded for every country. Country profiles must be reviewed by qualified local counsel before production enforcement.

## 5. Nigeria — first country profile

The Nigeria-specific baseline is in [Nigeria country policy](./nigeria-country-policy.md).

The initial Nigeria implementation should support:
- CAC-registered companies and business names, with entity form recorded;
- official CAC public-search evidence and/or licensed registry verification where access is authorized;
- documentary/manual fallback for registry cases that cannot be verified automatically;
- directors, beneficial owners/controllers and authorized representatives;
- individual KYC for the registering representative and other relevant people under the approved policy;
- consent-based NIMC/NIN verification only through approved access channels, if separately authorized;
- review, evidence, expiry and re-verification workflows.

Do not scrape CAC or NIMC systems, invent an undocumented government API, or collect raw NIN/biometric data by default.

## 6. Provider strategy

### Individual KYC
Reuse the existing Persona adapter and workflow as the first integrated individual-verification path, subject to Production credential/template/webhook verification and end-to-end acceptance. Persona is not assumed to cover every African country or every document type.

### KYB and specialist checks
The integration register identifies Sumsub as the preferred first candidate for evaluation, **not a selected or contracted provider**. Veriff, Trulioo, Smile ID, Dojah and other candidates remain challengers/fallbacks. Before selection, run the same country-by-country test matrix and validate:
- actual Nigerian and target-country document/registry coverage;
- company types, directors, shareholders and UBO coverage;
- authorized representative checks;
- manual fallback and case-management workflow;
- provider event semantics, API idempotency and webhook signature verification;
- data locations, subprocessors, retention/deletion, transfer safeguards and breach handling;
- security assurance, SLA, support, false-positive handling and appeals;
- price per check, retries, ongoing monitoring and minimum commitments.

Provider marketing claims or headline country counts are not acceptance evidence. No provider may be enabled for production until procurement, privacy/security review, contract and technical acceptance are complete.

## 7. Security and privacy requirements

- Obtain and record a valid purpose and lawful basis before collecting or sending personal data.
- Present clear, versioned notices and consent where required; do not bundle unrelated purposes.
- Minimize collection. Prefer provider-side document capture and normalized results over copying raw ID images or biometric templates into TradeMate.
- Encrypt data in transit and at rest; keep provider secrets in AWS Secrets Manager; never expose credentials to the browser or commit them.
- Keep evidence private, access-controlled and auditable. Reviewer access must be explicit and least-privileged.
- Verify file signatures, scan uploads for malware, enforce size/type limits and use safe download headers.
- Apply retention schedules, deletion/legal-hold rules and data-subject request procedures.
- Assess cross-border transfers and provider subprocessors before transmitting Nigerian personal data outside Nigeria.
- Use risk-based sanctions/PEP/adverse-media screening with human escalation for ambiguous matches; never auto-reject solely on a name-only fuzzy match.
- Log decision metadata and source references, not raw identity documents, full identity numbers, biometric data or unredacted provider payloads.
- Add rate limits, abuse detection, replay protection, idempotency and webhook reconciliation.

## 8. Integration sequence

1. **Foundation and audit:** confirm current Persona runtime configuration, webhook lifecycle, database migrations, document vault, organization review permissions and live/staging separation.
2. **Nigeria KYB data model:** introduce separate organization KYB cases, registry checks, people/ownership declarations, evidence references, policy versioning and audit history. Do not change existing organization activation semantics.
3. **KYB manual review:** add secure submission, reviewer queue, document access, request-more-information, approve/reject, appeal and expiry workflows. Use manual CAC evidence until a registry provider is authorized and accepted.
4. **Provider adapters:** formalize the KYC/KYB adapter boundary; finish Persona production acceptance and evaluate the KYB provider candidates.
5. **Risk controls:** add policy-driven sanctions/PEP/adverse-media checks and ongoing monitoring where required by the approved legal perimeter.
6. **Marketplace enforcement:** define which actions require which status (e.g. create organization, publish as a business, enter high-value contracts). Fail closed only for actions with an approved requirement; do not silently block unrelated user functionality.
7. **Additional countries:** add country profiles and acceptance evidence one country at a time.

## 9. Release gates

No real-user KYC/KYB launch until all applicable gates pass:

- country policy and privacy/legal review approved;
- provider contract, environment and template deployment confirmed;
- test cases for supported and unsupported documents and entity types pass;
- signature validation, duplicate webhook delivery, out-of-order events, retries and reconciliation pass;
- cross-user and cross-organization authorization tests pass;
- evidence downloads/previews are private and audited;
- manual review, appeals, expiry and provider outage fallback work;
- staging acceptance passes before any production change;
- production rollout is explicitly approved.

## 10. Out of scope until separately approved

- custody, escrow, deposits, withdrawals, money movement or payment initiation;
- automated legal conclusions or automatic sanctions decisions without human escalation;
- collecting/storing biometric templates or raw national identity numbers in TradeMate;
- claiming CAC/NIMC or any government integration before authorization and live technical acceptance;
- treating marketplace organization moderation as KYB approval.


## 11. Staging implementation checkpoint — 28 November 2026

Read-only inspection of AWS staging confirmed:
- `trademate/staging/api` contains non-empty `PERSONA_API_KEY` and `PERSONA_INQUIRY_TEMPLATE_ID` fields.
- `trademate/staging/persona-webhook-secret` exists separately and contains a non-empty `PERSONA_WEBHOOK_SECRET` field.
- The current `.github/workflows/aws-staging-configure-persona.yml` reads only `trademate/staging/api` and passes only the API key and template ID to the runtime helper.
- The current root-owned runtime helper accepts and writes only the Persona API key and template ID; it does not accept the webhook secret.
- The active GitHub staging image-publish role and EC2 instance profile were inspected read-only. Their current inline policies grant access to the API secret but not to the separate Persona webhook-secret ARN.

Therefore the existence of the webhook secret in Secrets Manager does **not** establish that the running API process has it. Runtime process state has not yet been inspected. The webhook controller returns service-unavailable when `PERSONA_WEBHOOK_SECRET` is absent.

Required next staging integration work:
1. Add a narrowly scoped `secretsmanager:GetSecretValue` permission for the exact webhook-secret ARN to the selected staging configuration principal.
2. Update and securely install the root-owned runtime helper so it validates, writes and verifies `PERSONA_WEBHOOK_SECRET` without printing it.
3. Update the manual staging configuration workflow to retrieve the separate secret and pass it to that helper.
4. Execute the configuration workflow only after explicit staging-change approval; verify the active API process and webhook signature path without using real customer identity data.

No AWS IAM policy, EC2 file, running service, database, Cloudflare Worker or production resource was changed during this inspection.
