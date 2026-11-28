# VeriFire persistence adapter — architecture gate and acceptance criteria

**Status:** Pre-implementation gate. No database engine, hosting service, AWS region, Cloudflare product, or data-residency location is selected by this document.

## Current environment observations (read-only review, 2026-11-28)

### Cloudflare

The connected Cloudflare account `Metadusk Inc` currently lists these Worker scripts:

- `trademate`
- `trademate-staging`
- `persona-inspector`

The account-level D1 database listing and Queues listing returned no resources. The R2 bucket listing returned Cloudflare error 10042 indicating R2 must be enabled in the dashboard. The two TradeMate Worker script-settings responses did not expose additional observability configuration; deployment metadata shows active production and staging Worker deployments.

These observations describe the connected account only. They do not prove that no other Cloudflare account, external database, or separately managed service exists. No VeriFire Worker, D1 database, Queue, R2 bucket, route, binding, secret, or deployment was created or changed.

### AWS

The connected AWS session identifies account `661406600284`. Read-only inventory attempts for Lambda, RDS, DynamoDB, ECS and S3 encountered explicit-deny service control policy errors for multiple services. A successful empty response from an individual region is not sufficient to establish account-wide absence.

**Result:** the current AWS connection cannot establish a trustworthy inventory of the resources relevant to a VeriFire persistence decision. Do not infer that AWS resources do not exist. The AWS organization administrator must grant the required read-only discovery permissions or provide an authoritative inventory before an AWS hosting decision.

## Decision gate — information required before choosing a persistence engine

1. **Hosting ownership:** confirm which AWS account and Cloudflare account own the VeriFire runtime, data plane, backups and operational alerts.
2. **Jurisdiction and residency:** define launch countries, controller/processor roles, permitted processing locations, cross-border transfer conditions, provider locations and any country-specific localization requirements.
3. **Data classification:** enumerate each persisted field and classify it as tenant metadata, authentication material, verification metadata, normalized outcome, audit record, provider reference or temporary evidence. Evidence is excluded from the ordinary operational store by default.
4. **Recovery objectives:** approve availability target, RPO, RTO, backup frequency, point-in-time recovery, restore testing and regional disaster-recovery requirements.
5. **Security ownership:** decide key/pepper custody, encryption-key ownership and rotation, service identities, network boundaries, privileged access, audit export and incident response.
6. **Operations and cost:** identify the team responsible for patching, upgrades, capacity, monitoring, on-call response, retention enforcement and predictable cost.

No engine or region should be selected until these inputs are documented and approved.

## Mandatory persistence-adapter acceptance criteria

A production adapter is acceptable only when all of the following are demonstrated by automated integration and concurrency tests:

### Atomicity and uniqueness

- Implements every repository in `src/repository-contracts.ts` through one documented transaction boundary.
- Tenant provisioning atomically creates the tenant, owner membership, initial entitlements, provisioning replay record and audit event.
- API-key creation/revocation commits its verifier/status change and audit event atomically.
- Verification acceptance atomically commits the verification record, idempotency record, audit event and outbox event.
- Enforces unique provisioning request-key hashes; same-key/same-fingerprint retries return the original result, while changed-fingerprint retries fail closed.
- Enforces tenant + operation + idempotency-key-hash uniqueness and duplicate external-reference rules under concurrent requests.
- Prevents overlapping active entitlement records for the same tenant/product, or defines a transactionally safe equivalent invariant.

### Tenant isolation and authorization

- Every tenant-owned lookup, update, delete and relationship check is tenant-scoped.
- Cross-tenant foreign-key attachment and object access fail closed even when callers supply valid identifiers from another tenant.
- Database row-level controls may provide defense in depth but do not replace repository-level tenant scoping.
- Platform-admin operations are isolated from tenant-admin operations and require trusted authenticated context outside the persistence adapter.

### Outbox concurrency and delivery

- `claimDue` atomically claims pending events and expired processing leases; competing workers cannot hold the same live lease simultaneously.
- Each claim issues a fresh unpredictable lease token and increments attempts atomically.
- `markDelivered` and `reschedule` enforce lease-token fencing; stale workers cannot acknowledge or reschedule a newer worker's claim.
- Handler execution occurs outside the database transaction.
- Crash/restart tests prove lease expiry and redelivery; duplicate handler delivery is expected and handlers must be idempotent.
- Retry scheduling, maximum attempts, dead-letter state and safe error-code persistence match the domain contract.

### Security, privacy and lifecycle

- API-key plaintext, provider credentials, end-user passwords, national-ID portal credentials, identity evidence and raw provider payloads are never persisted in ordinary operational tables or logs.
- API-key verifier and any pepper/key references follow an independently approved secret-custody design.
- Encryption at rest and in transit, access logging, backup encryption and key rotation are demonstrated.
- Retention and deletion workflows are enforceable by tenant, jurisdiction, record class and legal hold.
- Audit events are append-only to the application role; administrative access and tamper detection are documented.
- Backups, replicas, exports and dead-letter payloads follow the same residency and retention rules as primary records.

### Operability and proof

- Migrations are repeatable, versioned, reviewed and reversible where technically possible; destructive rollback limitations are documented.
- Load tests cover expected tenant count, request throughput, idempotency contention and outbox backlog.
- Failure-injection tests cover transaction abort, worker crash, network interruption, failover and restore.
- A tested backup restore demonstrates the approved RPO/RTO.
- Metrics and alerts cover transaction failures, pool saturation, replication lag, outbox age, dead-letter count, lease expiry and tenant-scoped error rates.
- Integration tests run against the actual candidate engine, not only mocks or in-memory substitutes.

## Explicitly deferred

Until the decision gate is approved, do not:

- select PostgreSQL, Aurora, DynamoDB, D1 or another database by assumption;
- create a database, schema, migration, bucket, queue, secret or encryption key;
- enable R2 or any other Cloudflare product;
- change AWS organization policies or account permissions;
- configure routes, bindings, DNS, deployments or production credentials;
- store identity evidence or provider payloads in the operational database.

## Next review sequence

1. Obtain an authoritative AWS read-only resource inventory and confirm the intended AWS account/region ownership.
2. Confirm whether the existing Cloudflare Workers are intended to host only the edge/API entry point or also any data-plane components.
3. Approve the initial country/jurisdiction and data-residency matrix.
4. Compare only the hosting/database candidates compatible with those approved constraints.
5. Record the selected architecture in a separate decision record and obtain approval before implementation or infrastructure changes.
