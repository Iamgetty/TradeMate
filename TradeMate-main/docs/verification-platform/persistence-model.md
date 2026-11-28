# Verification Platform — Persistence Model Proposal

**Status:** Logical model for review only. This document does not select a database, authorize infrastructure changes, or define a production migration.

## Design rules

- The verification platform owns its tenant boundary. It must not depend on TradeMate users, organizations, sessions, or tables.
- Every tenant-owned record carries an immutable `tenant_id`. Reads and writes are tenant-scoped at the repository boundary and, where supported, enforced again by database row-level controls.
- Tenant identity comes only from authenticated API-key context. Never accept a caller-supplied tenant ID as authority.
- Persist operational metadata and normalized outcomes only. Do not store end-user passwords, raw government identifiers, ID images, face images/templates, raw provider payloads, or full request bodies in the ordinary operational store.
- Keep provider credentials outside this model. Their custody remains an explicit unresolved product decision.
- Record timestamps in UTC. Use stable opaque identifiers; do not encode personal information in identifiers.

## Logical records

| Record | Minimum fields | Important constraints |
|---|---|---|
| Tenant | id, status, created_at, updated_at | Status is active, suspended, or closed. Closing a tenant blocks new work; retention/deletion follows the approved policy. |
| Integration API key | id, tenant_id, prefix, verifier, status, scopes, created_at, expires_at, last_used_at, revoked_at | Unique prefix; verifier only, never plaintext. Prefix lookup is non-secret. Status is active or revoked. |
| Product entitlement | id, tenant_id, product_id, status, starts_at, expires_at, created_at, updated_at | Unique active entitlement per tenant/product at a point in time. Status and effective dates are checked server-side. |
| Entitlement change/audit event | id, tenant_id, actor_type, actor_id, action, target_type, target_id, occurred_at, request_id, metadata_allowlist | Append-only. Metadata must be allowlisted and contain no credentials or identity evidence. |
| Verification request | id, tenant_id, product_id, external_reference, kind, country_code, status, outcome, policy_version, created_at, updated_at, completed_at | Tenant-scoped. Store only the integrator's opaque subject reference, not identity attributes or evidence. |
| Idempotency record | tenant_id, idempotency_key_hash, operation, request_fingerprint, resource_id, response_status, created_at, expires_at | Unique by tenant + operation + key hash. Same key with a different fingerprint is a conflict; replay returns the original result. |
| Provider execution | id, tenant_id, verification_id, adapter_key, provider_reference, status, outcome, reason_codes, started_at, completed_at | Tenant-scoped relation to verification. Provider reference only when contractually permitted; no raw response payload. |
| Webhook endpoint | id, tenant_id, url, status, event_profile, created_at, disabled_at | Tenant-scoped. Signing secret is stored only as a protected secret reference or verifier according to a separately approved secret design. |
| Webhook delivery/outbox | id, tenant_id, event_id, endpoint_id, attempt_count, next_attempt_at, delivered_at, status | Durable delivery state, deduplicated by event/endpoint. Payload contains only approved normalized event fields. |

The table is a conceptual contract, not a proposed physical schema. Names, types, indexes and partitioning are database-specific implementation details to decide after architecture review.

## API-key lifecycle

1. Generate a high-entropy key with a cryptographically secure random generator.
2. Show plaintext once to the authorized tenant administrator. Never log it or write it to project config.
3. Persist a verifier and a short prefix used only to locate the record. Consider a keyed HMAC verifier with a separately managed pepper after the secret-custody model is approved; never store the pepper beside the verifier.
4. Rotation creates a new key record. Permit a bounded overlap only when explicitly requested; record creation and revocation as audit events.
5. Revocation takes effect immediately for new requests. Expired and revoked keys fail with the same generic authorization response.
6. Update last-used metadata asynchronously or with a bounded write strategy so it cannot become a request-path bottleneck.

## Authorization and tenant isolation

- Resolve key by prefix, verify the secret, then check key status/expiry, tenant status, product entitlement status/effective dates, and required scopes.
- Do not return different public errors for unknown key, invalid key, suspended tenant, or missing entitlement.
- Every repository method that reads or mutates tenant-owned data must require the authenticated tenant context.
- Enforce tenant ownership in relationships, not only in application code. A verification request, provider execution, idempotency record, endpoint, and delivery must not be attachable across tenants.
- Apply rate limits before expensive authorization lookups and before any provider call. Enforce per-key and per-tenant quotas.
- Audit administrative changes, key lifecycle events, entitlement changes, policy changes, and access to sensitive operational records. Never audit secret or evidence contents.

## Transaction boundaries and reliability

- Tenant creation, initial key creation, and initial entitlement provisioning must be atomic or explicitly resumable with an idempotent operation.
- Key rotation/revocation and its audit event must commit together.
- Idempotency reservation and verification-request creation must be atomic. A duplicate request must not start a second provider execution.
- Persist a normalized request state and an outbox event in the same transaction; deliver webhooks asynchronously with bounded retries and replay protection.
- Provider calls must not occur inside a long-running database transaction. Persist a dispatchable execution record, call the adapter, then persist a normalized result.
- Use optimistic concurrency/version fields for state transitions where concurrent workers may update the same request.

## Retention, privacy and deletion

Retention periods, legal basis, controller/processor roles, data residency, subject-rights workflows, and deletion exceptions must be approved for each launch jurisdiction before production storage is enabled.

The default design is data minimization: retain opaque references, normalized outcomes, policy/version metadata and narrowly scoped audit facts. Do not retain evidence by default. If a provider requires evidence retention or returns a provider reference, document the legal basis, contract, region, retention period, access path and deletion mechanism before enabling that adapter.

Tenant closure must stop new work and trigger an approved lifecycle workflow. It must not silently erase legally required audit records or leave provider-side evidence unmanaged.

## Decisions still required before implementation

1. Select the persistence engine and hosting boundary after reviewing the current AWS and Cloudflare architecture, operational ownership, data-residency needs, backup/restore and recovery objectives.
2. Approve tenant-administrator identity and authorization for provisioning, key rotation, entitlement changes and account closure.
3. Approve API-key verifier/pepper custody and webhook signing-secret custody.
4. Set jurisdiction-specific retention, deletion, audit and evidence policies.
5. Decide whether provider references may be stored and for how long under each provider contract.

Until these decisions are approved, keep persistence behind repository interfaces and use test doubles only. Do not create migrations, databases, secrets, infrastructure, DNS records, or deployments from this proposal.
