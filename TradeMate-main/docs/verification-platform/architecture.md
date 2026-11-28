# Metadusk VeriFire — Architecture Baseline

**Status:** Initial architecture baseline; implementation is not production-ready.  
**Product boundary:** Independent verification infrastructure. TradeMate is the first intended integration client, not the platform's identity or tenancy boundary.

## Product experience

The product is installed and configured from a terminal, in the spirit of installing and using Node.js tooling. The developer installs a small CLI/package, initializes a project, connects an integration, and uses a documented SDK or HTTP API. The CLI is the installation and developer-operations surface; it is not the verification engine and does not make verification decisions locally.

Illustrative developer journey (package namespace ownership remains subject to registry availability):

```sh
npm install --global @metadusk/verifire-cli
verifire init
verifire connect
verifire doctor
```

Applications then call a versioned hosted API, for example:

```http
POST /v1/verifications
Authorization: Bearer <integration-api-key>
Idempotency-Key: <unique-request-key>
Content-Type: application/json
```

The CLI may configure a local project file containing a service URL and integration reference. It must not write plaintext API keys into source control, shell history, logs, telemetry, or a committed project file. Prefer an OS credential store where available; otherwise require an explicit environment variable or protected secret injection at runtime.

## System boundaries

1. **CLI / installer** — install, initialize, validate configuration, authenticate an integration, inspect service health, and generate typed client configuration. It does not collect or persist identity evidence.
2. **SDKs / public API** — stable, versioned integration contract for third-party platforms. HTTP is the canonical interface; webhooks and optional WebSocket subscriptions deliver asynchronous lifecycle events.
3. **Verification control plane** — tenant authentication, authorization, policy selection, request orchestration, idempotency, quotas, audit metadata, result normalization and event dispatch.
4. **Provider adapter layer** — replaceable adapters to authorized identity, document, face/liveness, business registry, ownership and (where lawful) risk-data sources. Provider availability is country- and contract-specific.
5. **Persistence boundary** — store only what is necessary to operate the service: tenant/integration metadata, hashed integration-key verifiers, policy versions, verification IDs, normalized outcomes, minimal audit metadata, idempotency records and provider evidence references where lawful and contractually permitted.

No production provider connector is implied by this architecture. A provider must not be integrated until the source, legal basis, access method, data-processing terms, retention, geographic scope and operational ownership are approved.

## Credentials and sensitive data

- This platform is not a credential vault and does not store end-user login credentials.
- Integration API keys are generated with cryptographically secure randomness, displayed once, and stored only as a one-way verifier (hash/HMAC verifier with a separately managed pepper if adopted). Support rotation, revocation, expiry, scopes and per-tenant limits.
- Never store raw government identifiers, passwords, authentication secrets, face images, biometric templates, raw document images or unredacted provider responses in the ordinary application database.
- Sensitive evidence should be processed transiently and sent only to an explicitly authorized provider. Persist only a normalized result and the minimum provider reference required for traceability, subject to local law and contract.
- Do not log request bodies, authorization headers, API keys, identity values, biometrics or provider payloads. Redact errors and traces.
- Provider-side credentials are **not yet decided**. No provider credentials or secret-manager integration may be implemented until the product owner explicitly decides whether the platform may hold provider credentials outside its application database, or whether provider access must be delegated.
- The CLI must not request or store a third-party platform's end-user credentials.

## Integration security

- Every integration belongs to a tenant. Every request is authorized against the tenant and key scopes before any provider call.
- API keys are high-entropy opaque tokens with a non-secret public prefix/key ID for lookup and a one-way verifier for validation. The plaintext token is returned once only.
- Enforce TLS, request size limits, schema validation, replay/idempotency protection, rate limits, quotas, key rotation/revocation, and audit trails.
- Webhooks use per-endpoint signing secrets, timestamped signatures, replay windows, retry/backoff, delivery IDs and a verification helper. Webhook signing secrets are distinct from API keys.
- WebSocket access, if offered, must authenticate with short-lived scoped tokens; never place long-lived API keys in query strings.
- Tenant identifiers are derived from authenticated credentials, never trusted from caller-supplied body fields.
- Verification outcomes are normalized: `verified`, `not_verified`, `inconclusive`, `manual_review`, and `not_supported`. A provider outage must not be represented as a negative identity finding.
- Record source/provider, policy version, timestamps and reason codes without exposing sensitive source payloads.

## Verification domains

Initial capability families:
- Individual identity and government-ID validation.
- Face match and liveness checks, only with valid consent and authorized biometric processing.
- Business registration/status and entity-detail validation.
- Directors, representatives, ownership and beneficial-ownership checks where authoritative data is lawfully accessible.
- Optional sanctions, PEP and adverse-media screening only after jurisdictional, legal and provider review.

The service validates data against authorized existing sources; it is not a government database, does not claim universal database access, and must not infer a successful check where a source is unavailable.

## API lifecycle (target)

1. An integrator creates a verification request using an idempotency key and an allowed verification type/country.
2. The API authenticates the integration and checks tenant scope, product entitlement, country policy and consent/attestation requirements.
3. The orchestrator dispatches only supported checks to configured authorized adapters.
4. Adapters return typed provider responses. The orchestrator maps them into normalized outcomes and redacted reason codes.
5. The service persists minimal case state and audit metadata, then emits a signed webhook and/or scoped real-time event.
6. The integrator retrieves the result using its verification ID. Results include policy version, check timestamps, source references where permitted and an expiry/recheck recommendation where applicable.

## Deployment direction

The verification service must have its own deployable boundary, runtime configuration, health checks, release lifecycle, data model and operational monitoring. It must not be mounted into the TradeMate NestJS API, use TradeMate session cookies, or depend on TradeMate users/organizations tables.

AWS and Cloudflare are the current infrastructure environments in this project, but no service placement, database, domain, DNS, IAM, secret, or deployment changes are authorized by this architecture document. Select the runtime after reviewing the current AWS and Cloudflare architecture and the product's latency, data-residency and operational requirements. Do not use Render.

## Initial implementation sequence

1. Freeze the product boundary and threat model; keep the superseded TradeMate-bound PR #350 unmerged.
2. Add an independent service package with health/readiness, API contract validation and adapter interfaces only.
3. Add the CLI installer and safe local configuration workflow.
4. Implement tenant/integration key lifecycle and isolation tests.
5. Implement normalized verification orchestration with mock adapters; label mock results clearly and never present them as real verification.
6. Add approved provider adapters one at a time after access/legal approval.
7. Add signed webhooks, retries, event delivery and SDKs.
8. Integrate TradeMate as a normal external client and run staging acceptance before any production rollout.

## Open decisions

- Provider credential model: delegated provider authorization only, or provider secrets held outside the application database in an infrastructure secret manager. **Unresolved; do not implement either path yet.**
- npm namespace ownership and package publication access.
- First production countries and the precise authorized source/provider for each verification check.
- Whether WebSocket subscriptions are required in v1 or signed webhooks are sufficient.
- Data residency, retention schedule, deletion policy and legal basis by country.
- Hosting split between AWS and Cloudflare after an explicit architecture review.
