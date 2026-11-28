# VeriFire African country authentication and verification architecture

## Product requirement

VeriFire is designed to support customers and end users across African countries through one stable API. Country support is a first-class platform dimension, not a Nigeria-only implementation with country checks added later.

"Authentication" must be separated into two distinct jobs:

1. **Account and integration authentication**: authenticate the developer/business calling VeriFire (API keys now; tenant administrators and stronger authentication to be implemented).
2. **End-user identity verification**: verify a person or business using the identity evidence and legally available sources appropriate to the person's country and the requested assurance level.

A valid API key proves which integration is calling. It does not prove the identity of the end user being checked.

## One API, country-aware verification

The public API should remain consistent across countries. A request identifies:
- the subject type (person or business);
- the subject's country of identity or registration using ISO 3166-1 alpha-2;
- the requested verification product and version;
- the requested assurance level / checks;
- a caller-generated idempotency key.

The server resolves the country and product against a versioned coverage registry. Clients must not choose a provider directly or bypass server-side country, entitlement, policy, or scope checks.

Illustrative request (contract proposal, not an implemented endpoint):

```json
{
  "product": "kyc",
  "version": "1.0.0",
  "subject": {
    "type": "person",
    "country": "NG"
  },
  "assurance": "standard"
}
```

Do not send identity-document images or full identity numbers in ordinary request metadata. If a future approved provider flow requires sensitive evidence, it must use a separately designed secure upload/token flow with strict access, encryption, retention and deletion controls.

## Country coverage registry

Create a versioned, server-owned registry. Each country/product combination records:
- ISO country code and supported subject type;
- accepted evidence/document categories (not assumptions about universal document availability);
- available verification methods and their assurance limits;
- approved provider adapters and their contractual coverage;
- local language and localization requirements;
- consent, lawful-basis, notice and retention requirements;
- data-residency / cross-border transfer constraints;
- operational status, effective dates and last review date;
- known limitations, fallback route and escalation process.

Coverage status is explicit:
- `not_assessed`: research and legal review not completed;
- `planned`: candidate country, no live capability;
- `pilot`: restricted, monitored testing only;
- `live`: approved production route with evidence of operational readiness;
- `degraded`: a live route is temporarily impaired; policy-approved fallback only;
- `suspended`: no new checks accepted.

A country is not "supported" merely because a provider advertises broad regional coverage. A product-country pair becomes `live` only after technical tests, provider contract and permitted use, legal/privacy review, security review, operational support, and documented fallback are approved.

## Country coverage strategy

- Use ISO 3166-1 alpha-2 identifiers internally; maintain a reviewed country/territory reference list rather than hard-coding country names throughout business logic.
- Design the registry to cover all African jurisdictions in the agreed product scope. Confirm the exact jurisdiction list with legal/compliance before launch, including how territories and disputed jurisdictions are represented.
- Assess each country independently. Do not infer national-ID access, document formats, registry connectivity, legal permissions, or provider coverage from a neighbouring country.
- Support country-specific evidence categories and transliteration/name-matching rules as configurable policy, not scattered conditionals.
- Support localized user notices and consent experiences where required.
- Provide a consistent result envelope across countries, while exposing method, assurance, limitations, timestamps and reason codes so a result is never presented as stronger than the underlying check.
- Where automated checks are unavailable or legally unsuitable, return an explicit `unavailable` / `manual_review_required` outcome. Never silently downgrade assurance or claim a successful verification.

## Provider routing and fallback

Provider adapters are country- and product-scoped. The routing service must:
1. validate tenant, API-key status, exact scope, entitlement and rate limits;
2. validate that the requested country/product/assurance combination is enabled;
3. select only an approved adapter with current contractual and operational status;
4. apply the relevant data-minimization and transfer policy;
5. record a minimal audit and provider-execution reference;
6. normalize provider responses into VeriFire result codes without erasing uncertainty;
7. use only explicitly approved fallback routes.

Provider outages must not cause automatic routing to an unapproved provider or cross-border destination. Provider credentials must remain in an approved secret-management system and must never be returned to clients or written to logs.

## Result model principles

A normalized result should distinguish at least:
- `verified`;
- `not_verified`;
- `inconclusive`;
- `unavailable`;
- `manual_review_required`;
- `pending`.

It should also identify the product/version, country, verification method category, assurance level, completion time, expiry/recheck guidance where applicable, and safe reason codes. Avoid returning raw provider payloads, full document numbers, biometrics or unnecessary personal data.

## Security, privacy and compliance gates

Before enabling a country/product pair, document:
- the permitted purpose and lawful basis for the specific check;
- notices and consent requirements (where applicable);
- controller/processor roles and provider data-processing terms;
- cross-border transfer and data-residency analysis;
- evidence minimization, retention, deletion and data-subject request handling;
- security controls, incident process and auditability;
- sanctions/AML or other regulated-use restrictions relevant to the product;
- human review and dispute/correction process for adverse or inconclusive outcomes.

Do not assume one pan-African privacy or identity law. Requirements must be reviewed per jurisdiction and per provider/data flow. This document is an engineering architecture requirement, not legal advice or a claim of regulatory approval.

## Rollout plan

1. Define the initial country/jurisdiction inventory and legal review process.
2. Build the country/product coverage registry and policy evaluation contract before connecting providers.
3. Select a small pilot set based on lawful access, provider quality, operational readiness and customer need—not presumed market coverage.
4. Implement mock adapters and contract tests for routing, unavailable states, fallback restrictions, idempotency and audit.
5. Complete a country-specific approval pack before each pilot/live enablement.
6. Expand country by country while keeping the API contract stable and publishing an accurate live-coverage matrix.

## Current implementation status

This is an architecture requirement and implementation plan. The current VeriFire PR does **not** yet contain a live country registry, country-specific document rules, national identity integrations, provider contracts, or live verification routes. No African country should currently be advertised as production-supported on the basis of this document.

The existing persistence-neutral repository contracts and API-key lifecycle services are foundations only. Country policy, coverage records, provider routing and production persistence remain future implementation work.
