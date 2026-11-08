# AWS backend and Cloudflare frontend foundation

## Architecture decision

TradeMate uses a split-cloud architecture:

- **AWS is the primary application and data platform** for production backend workloads.
- **Cloudflare hosts and serves the frontend** and provides DNS, WAF, DDoS protection and edge traffic controls.
- **Render is retained as a secondary environment for staging, testing, QA and pre-release validation**. It is not the production source of truth or the primary production rollback platform.
- GCP is outside the initial migration scope.

This directory is the implementation entry point for the AWS backend staging environment. This is a design and repository change only; it does not provision or modify cloud resources.

## Workload placement

| Existing workload | Target platform |
|---|---|
| `trademate-web` (Next.js 16, React 19) | Cloudflare Workers; evaluate vinext (Cloudflare's current recommended path for Next.js 16+) against the OpenNext adapter using compatibility and production-build tests before choosing; Cloudflare serves the frontend and static assets |
| `trademate-api` (NestJS, Node.js) | AWS ECS Fargate behind an Application Load Balancer |
| `exchange-feed` (Node.js WebSocket service) | AWS ECS Fargate behind WebSocket-capable ALB routing, subject to connection, idle-timeout and drain testing |
| PostgreSQL 18 | Amazon RDS for PostgreSQL, private subnets, encrypted storage, automated backups and tested restore |
| Backend secrets and configuration | AWS Secrets Manager for secrets; task environment only for non-secret configuration |
| Backend deploy history/logs | GitHub Actions release pipeline and CloudWatch logs/metrics/alarms |
| Frontend deployment and edge delivery | Cloudflare Workers deployment pipeline, with Cloudflare-managed routing, TLS and edge controls |

Cloudflare's current guidance recommends vinext as the default path for Next.js 16+ on Workers, while documenting OpenNext as an alternative for applications that need it. vinext is in beta, so do not adopt it solely on the recommendation. Run its compatibility check and review the compatibility dashboard, then compare a staging build and runtime smoke tests against the OpenNext adapter. Preserve the existing Next.js build and Node.js deployment until one path passes. Validate the application's actual use of SSR, route handlers, middleware/proxy, image optimization, runtime APIs, server actions and Node-specific packages. Do not assume a static export is sufficient. Cloudflare Pages is not the default target for this SSR application; target Workers after the adapter decision is evidence-based.

The first AWS staging region is proposed as **us-west-2 (Oregon)** because the current API and PostgreSQL production resources are co-located in Render Oregon. This is a migration starting point, not a final global-region decision; validate user geography, latency and data-residency requirements before production placement. The existing Frankfurt feed must be load-tested before deciding whether to keep it in a second region or consolidate it.

## AWS backend staging topology

- Dedicated AWS account or isolated staging account under AWS Organizations; do not mix staging and production resources.
- VPC across at least two Availability Zones.
- Public subnets contain only the internet-facing ALB and required egress components.
- ECS tasks and RDS stay in private subnets; no public database endpoint.
- RDS PostgreSQL 18 compatibility must be verified against the exact extensions, collation, parameter settings and migration history used by TradeMate.
- Security groups allow ALB-to-service traffic and API-to-database traffic only. No broad database CIDRs.
- KMS encryption for RDS, logs and secrets; task roles use least-privilege IAM.
- Secrets Manager holds database credentials, TOTP encryption key and provider credentials. Never commit values or copy Render secret values into GitHub.
- CloudWatch log groups have explicit retention; alarms cover task health/restarts, ALB 5xx/latency, RDS storage/connections/CPU and deployment failures.
- Use immutable container images in ECR, tagged with the Git commit SHA. GitHub Actions builds/tests/scans and deploys backend staging only after required checks pass.
- Database migrations run as a one-off ECS task/release step, not automatically in every API replica's startup command.
- Preserve WebSocket upgrade behaviour, idle timeouts, health checks and graceful connection draining for the exchange feed.
- Configure the Cloudflare frontend's API origin, CORS allowlist, cookie domain/SameSite/Secure attributes, CSRF protections and authentication redirects deliberately. Do not expose private AWS service endpoints.
- Cloudflare-to-AWS origin traffic must use TLS and a restricted, authenticated origin path where feasible. Do not rely on an obscured hostname as origin protection.
- Keep API caching disabled by default for authenticated or user-specific responses; add explicit cache rules only after response semantics are reviewed.

## Migration execution gates

1. **Foundation (this change):** record platform responsibilities, workload mapping, region assumptions, security boundaries and operational gates.
2. **Provision AWS backend staging:** after AWS account access and region approval, create the staging VPC, IAM roles, ECR, ECS cluster/services, ALB, RDS and observability using reviewed infrastructure-as-code.
3. **Prepare Cloudflare frontend delivery:** compare vinext and OpenNext compatibility for the existing Next.js 16 application; retain the current deployment until one passes staging build and runtime tests. Then configure a separate staging Worker/environment, bind staging-only API origins and secrets, and add a reviewed frontend deployment workflow. Do not change production routes or DNS.
4. **Build and deploy:** containerize backend workloads, pin runtime versions, configure health checks and secret references, and grant staging-only GitHub OIDC deployment permissions.
5. **Data rehearsal:** create an encrypted backup/export of staging data, restore to RDS, apply migrations, verify row counts and application invariants. Never use production data for staging without explicit data-handling approval and an approved sanitization process.
6. **Acceptance:** test auth/session/TOTP, contracts, enquiries, feed/WebSockets, uploads, scheduled jobs, email/provider integrations, frontend rendering/routing, CORS/CSRF, database recovery, load, security and rollback.
7. **Production migration:** separate change plan and explicit approval required for production data transfer, Cloudflare production route/DNS changes, secret rotation, service shutdown or traffic cutover.

## Blocking inputs for provisioning

- AWS account ID and confirmation that the account is ready for TradeMate.
- Approval to use `us-west-2` for the first AWS staging deployment.
- AWS access path: preferably GitHub Actions OIDC with a narrowly scoped staging deployment role; do not send access keys or secrets in chat.
- Monthly AWS staging budget ceiling and desired RDS/ECS availability profile.
- Cloudflare account access and an approved staging hostname/zone for the frontend deployment. Do not share API tokens in chat; use a secure secret-management flow.

## Guardrails

- This repository change does not provision, modify or delete cloud resources.
- No production Render resource, database, secret, DNS record, Cloudflare route or deployment is changed.
- No production database backup or customer data is copied.
- Do not run `terraform apply`, deploy workflows, database migrations, Cloudflare production route changes or DNS changes without the relevant explicit approval.
- Keep Render available as a separate staging/testing/QA environment. Do not treat it as production or automatically synchronize production data/secrets into it.
- AWS is the production backend source of truth; Cloudflare is the frontend hosting and edge delivery platform.
