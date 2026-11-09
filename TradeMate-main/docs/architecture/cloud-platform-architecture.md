# TradeMate unified cloud platform architecture

**Status:** Proposed architecture baseline; documentation only.  
**Last reviewed:** 2026-11-09  
**Approval boundary:** This document does not authorize cloud provisioning, paid services, production changes, DNS/routing changes, secret population, data migration, deployment or cutover.

## 1. Architecture decision

TradeMate will use a staged, provider-portable architecture:

1. **Cloudflare** remains the primary public edge and frontend delivery layer.
2. **Oracle Cloud Infrastructure (OCI)** is the immediate backend-hosting candidate to investigate for an interim deployment, subject to European home-region availability, capacity, ARM64 compatibility, MT5 bridge connectivity, security, backup/restore and reliability checks.
3. **Render** remains the isolated staging, preview, testing and QA platform.
4. **AWS remains the strategic target cloud architecture** recorded in the existing hybrid-cloud roadmap. The completed AWS infrastructure work and documentation are retained. AWS production deployment remains gated by organization permissions, cost approval, security review and explicit release approval.
5. **Amazon CloudFront remains part of the AWS architecture** for approved AWS-backed content and distribution use cases. It is not automatically layered behind or in front of Cloudflare; the delivery path must be selected per hostname/content origin to avoid duplicate caching, extra hops and unnecessary cost.
6. **Google Cloud Platform (GCP)** remains a future strategic option, adopted only where a specific workload, resilience, data or commercial requirement justifies it.

The OCI investigation changes the proposed *deployment sequence*, not the long-term AWS/GCP roadmap or the product architecture. OCI must not become a permanent dependency in application code.

## 2. Platform responsibilities

| Platform | Primary responsibility | Explicit boundaries |
|---|---|---|
| Cloudflare | Public DNS, TLS, WAF/DDoS controls, edge routing and frontend delivery | Not the authoritative application database; Workers are for suitable edge workloads, not the continuously running MT5 bridge process |
| OCI (interim candidate) | Candidate host for NestJS API, exchange-feed/MT5 bridge services, background workers and PostgreSQL | Not approved or deployed yet; no production SLA is assumed for Always Free capacity |
| Render | Staging, QA, preview and pre-release verification | Keep isolated from production data and production secrets; free-tier sleep/expiry limits must be accounted for |
| AWS | Strategic target infrastructure: networking, container workloads, registry, database, secrets, observability and supporting services | Existing templates/PRs are not evidence that resources exist; deployment requires permissions and explicit approval |
| CloudFront | AWS CDN/distribution for selected AWS-backed origins, static assets or downloads | Do not chain CloudFront and Cloudflare by default; document origin, cache policy, TLS and invalidation ownership |
| GCP | Future optional cloud for justified workloads | No parallel deployment or data replication until a use case, ownership, security and cost model are approved |
| GitHub | Source of truth, pull requests, CI, artifact provenance and controlled deployment workflows | Secrets must not be committed; production workflows require protected environments and approvals |

## 3. Logical application layout

The application should remain portable and be split by responsibility, regardless of provider:

- **Frontend:** TradeMate web application, delivered through Cloudflare.
- **API:** NestJS application serving authenticated and public application requests.
- **Exchange feed:** Dedicated feed service responsible for provider connections, quote normalization, freshness and fan-out.
- **MT5 integration:** Existing bridge/API integration. Confirm its protocol, authentication, reconnect semantics, network allow-list requirements, throughput and ARM64/native dependency compatibility before selecting a host.
- **Workers:** Independently restartable background jobs for notifications, media processing, reconciliation and other approved asynchronous work.
- **Database:** PostgreSQL as the authoritative store for application state, contracts, audit records and other durable data.
- **Cache/queues:** Add only when justified by measured load and defined consistency/delivery semantics. Cache is not the source of truth for durable or financial records.
- **Object storage:** Private user uploads and generated assets with encryption, access controls, retention and deletion policies.
- **Operations:** Central logs, metrics, traces, alerting, backups, restore drills and incident runbooks.

## 4. Request and data-flow rules

1. Users resolve TradeMate public hostnames through the approved DNS/edge configuration.
2. Cloudflare terminates public edge traffic and applies the configured security and routing policies.
3. Frontend requests reach the selected API origin over authenticated TLS.
4. The API and workers access PostgreSQL through private networking where the provider supports it; the database is never exposed directly to the public internet.
5. The exchange-feed service maintains the outbound connection to the MT5 bridge/provider, validates and timestamps incoming data, and exposes feed health and freshness. Stale quotes must never be represented as live.
6. WebSocket clients reconnect with bounded backoff; server deployments drain connections safely and expose disconnect/reconnect metrics.
7. Static content and private downloads use a single documented CDN path per hostname/content class. CloudFront is used for AWS-backed distribution when selected; Cloudflare remains the general public edge unless a deliberate exception is approved.
8. Backups are encrypted, stored separately from the primary database failure domain, and periodically restored in a test environment.

## 5. Environment separation

| Environment | Purpose | Hosting direction | Data policy |
|---|---|---|---|
| Local development | Feature development and automated tests | Developer machines / containers | Synthetic or sanitized data |
| Staging | Integration, preview, regression and release checks | Render initially; provider-specific staging may be added later | Separate database, credentials and storage; no production secrets |
| Interim deployment candidate | Validate a portable backend deployment and MT5 connectivity | OCI only after the investigation and approval gates pass | Separate environment and database; production use requires a separate approval |
| Strategic AWS environment | Future target infrastructure and migration rehearsal | AWS in the approved region, currently documented as eu-north-1 for the existing staging foundation | Isolated accounts/roles, network, database, secrets and backups |
| Future GCP workloads | Only approved workload-specific expansion | GCP | Independent data/security boundary and documented ownership |

There must be only one authoritative production writer for each dataset at a time. Do not run independent production databases with uncontrolled dual writes. Any migration requires a defined replication/consistency plan, freeze window, validation and rollback procedure.

## 6. Repository organization

Keep application code and provider-specific infrastructure separate. The intended organization is:

```text
TradeMate/
├── apps/
│   ├── frontend/
│   ├── api/
│   └── exchange-feed/
├── services/
│   ├── mt5-bridge/
│   └── background-workers/
├── database/
│   ├── migrations/
│   └── schemas/
├── infrastructure/
│   ├── cloudflare/
│   ├── oracle/
│   ├── render/
│   ├── aws/
│   │   ├── networking/
│   │   ├── ecs/
│   │   ├── rds/
│   │   └── cloudfront/
│   └── gcp/
├── security/
├── monitoring/
├── docs/
│   ├── architecture/
│   ├── deployment/
│   ├── disaster-recovery/
│   └── roadmap/
└── .github/
    └── workflows/
```

This is a target organizational map, not a claim that every directory or service already exists. Preserve the repository's current paths and move files only in separately reviewed changes.

## 7. Delivery and migration sequence

### Stage A — Organize and inventory
- Treat this document as the cross-platform architecture reference.
- Inventory actual application services, current Render resources, domains/DNS, environment-variable names (never secret values), database size/extensions, object storage, scheduled jobs, CI/CD and current costs.
- Record actual service ownership, region, deployment ID and operational status only after verification.
- Reconcile existing AWS PRs and templates against the agreed architecture; do not merge open PRs without review and approval.

### Stage B — OCI feasibility gate
- Verify which European home regions are offered during signup; OCI home region is a material account decision.
- Verify Ampere A1 capacity before designing around it; free capacity is not guaranteed.
- Build and test ARM64 images for every required container and native dependency.
- Verify MT5 bridge protocol, authentication, outbound networking, reconnect behaviour, latency and feed throughput.
- Size API, feed, workers and PostgreSQL together; confirm disk, memory, CPU, backup and restore requirements.
- Review idle-instance reclamation rules, account activity requirements, security controls and absence of a production SLA.
- Do not put live production trading or customer data on OCI until all gates pass and the owner explicitly approves.

### Stage C — Staging and release readiness
- Keep Render staging isolated and test API, database migrations, feed freshness, WebSocket reconnects, worker retries, backup restoration, security scans and failure recovery.
- Promote immutable, tested artifacts through protected GitHub Actions environments.
- Keep database migration privileges separate from runtime application credentials.

### Stage D — AWS strategic target
- Retain the merged AWS foundation and documentation work.
- Resolve the documented IAM/SCP authorization blockers through the account administrators; do not attempt to bypass organization-level denies.
- Review the open AWS staging change-set workflow PR separately. It creates a change set only and does not authorize execution or provisioning.
- Rehearse the target architecture in isolated staging before considering any production migration.

### Stage E — Optional GCP expansion
- Require a concrete workload and a written decision covering data ownership, network boundaries, security, observability, operating cost and exit strategy.
- Avoid multi-cloud duplication without a measurable benefit.

## 8. Operational and security guardrails

- No cloud resources, paid services, production deployments, production cutovers, DNS/routing changes, Cloudflare changes, secret population or billing changes without separate explicit approval.
- Never commit secret values or copy credentials between environments.
- Use least-privilege identities and short-lived workload identity/OIDC where supported; organization-level policy denies must be respected.
- Keep PostgreSQL private, encrypted and backed up; test restoration, not merely backup creation.
- Define RPO/RTO, incident ownership, health checks, alert thresholds and rollback procedures before production.
- Do not claim free-tier uptime guarantees. Free resources can have capacity limits, idle reclamation, service restrictions and no production SLA.
- Keep provider-specific SDKs and infrastructure definitions behind clear boundaries so the application remains portable.
- Avoid sending the same hostname through Cloudflare and CloudFront in series unless an explicit, tested design requires it.
- Record each architecture decision with date, rationale, alternatives, owner and approval status.

## 9. Current decision register

| Decision | Status | Next evidence required |
|---|---|---|
| Cloudflare is the primary public edge/frontend layer | Retained | Confirm current hostname/origin mapping during read-only inventory |
| OCI is the immediate backend-hosting candidate | Proposed; not provisioned | European home-region and A1 capacity, ARM64, MT5 connectivity, security and restore tests |
| Render is staging/QA | Retained | Inventory current services and isolate staging data/secrets |
| AWS is the strategic target architecture | Retained | Resolve IAM/SCP constraints and complete reviewed staging rehearsal |
| CloudFront is retained for selected AWS distribution | Retained | Define origin and cache policy per content class; avoid unnecessary CDN chaining |
| GCP is a future option | Deferred | Identify a justified workload before adoption |
| Production cutover | Not authorized | Separate explicit approval after all acceptance gates pass |

## 10. Related records

- Product and engineering roadmap: [../roadmap.md](../roadmap.md)
- Existing AWS staging and hybrid-cloud changes: review the repository's AWS infrastructure pull requests and their current status before execution.
- This document is the platform responsibility and sequencing reference; it does not replace service-specific runbooks, threat models, deployment templates or provider documentation.
