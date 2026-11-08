# AWS staging foundation

## Decision

AWS is the target cloud for TradeMate. This directory is the implementation entry point for the first AWS staging environment. Render remains available as the rollback environment until AWS production cutover is separately approved.

## Existing workload to migrate

| Render workload | AWS target |
|---|---|
| `trademate-api` (NestJS, Node.js) | ECS Fargate service behind an Application Load Balancer |
| `trademate-web` (Next.js, Node.js) | ECS Fargate service behind an Application Load Balancer; CloudFront can be added after cache and routing behaviour is verified |
| `exchange-feed` (Node.js WebSocket service) | Separate ECS Fargate service with WebSocket-capable ALB routing and connection/drain testing |
| PostgreSQL 18 | Amazon RDS for PostgreSQL, private subnets, encrypted storage, automated backups and tested restore |
| Render environment variables | AWS Secrets Manager for secrets; task environment only for non-secret configuration |
| Render deploy history/logs | GitHub Actions release pipeline and CloudWatch logs/metrics/alarms |

The first staging region is proposed as **us-west-2 (Oregon)** because the current API, web and PostgreSQL production resources are co-located in Render Oregon. This is a migration starting point, not a final global-region decision; validate user geography, latency and data-residency requirements before production placement. The existing Frankfurt feed must be load-tested before deciding whether to keep it in a second region or consolidate it.

## Staging topology

- Dedicated AWS account or isolated staging account under AWS Organizations; do not mix staging and production resources.
- VPC across at least two Availability Zones.
- Public subnets contain only the internet-facing ALB and required egress components.
- ECS tasks and RDS stay in private subnets; no public database endpoint.
- RDS PostgreSQL 18 compatibility must be verified against the exact extensions, collation, parameter settings and migration history used by TradeMate.
- Security groups allow ALB-to-service traffic and API-to-database traffic only. No broad database CIDRs.
- KMS encryption for RDS, logs and secrets; task roles use least-privilege IAM.
- Secrets Manager holds database credentials, TOTP encryption key and provider credentials. Never commit values or copy Render secret values into GitHub.
- CloudWatch log groups have explicit retention; alarms cover task health/restarts, ALB 5xx/latency, RDS storage/connections/CPU and deployment failures.
- Use immutable container images in ECR, tagged with the Git commit SHA. GitHub Actions builds/tests/scans and deploys staging only after required checks pass.
- Database migrations run as a one-off ECS task/release step, not automatically in every API replica's startup command.
- Preserve WebSocket upgrade behaviour, idle timeouts, health checks and graceful connection draining for the exchange feed.
- Cloudflare remains the DNS/WAF/DDoS edge layer. CloudFront is introduced only after origin access, cache policy and WebSocket routing boundaries are explicitly configured.

## Migration execution gates

1. **Foundation (this change):** record topology, workload mapping, region assumptions, security boundaries and operational gates.
2. **Provision staging:** after AWS account access and region approval, create the staging VPC, IAM roles, ECR, ECS cluster/services, ALB, RDS and observability using reviewed infrastructure-as-code.
3. **Build and deploy:** containerize each workload, pin runtime versions, configure health checks, secret references and staging-only GitHub OIDC deployment permissions.
4. **Data rehearsal:** create an encrypted backup/export of staging data, restore to RDS, apply migrations, verify row counts and application invariants. Never use production data for staging without explicit data-handling approval and an approved sanitization process.
5. **Acceptance:** test auth/session/TOTP, contracts, enquiries, feed/WebSockets, uploads, scheduled jobs, email/provider integrations, database recovery, load, security and rollback.
6. **Production migration:** separate change plan and explicit approval required for production data transfer, DNS changes, secret rotation, service shutdown or traffic cutover.

## Blocking inputs for provisioning

- AWS account ID and confirmation that the account is ready for TradeMate.
- Approval to use `us-west-2` for the first staging deployment.
- AWS access path: preferably GitHub Actions OIDC with a narrowly scoped staging deployment role; do not send access keys or secrets in chat.
- Monthly staging budget ceiling and desired RDS/ECS availability profile.

## Guardrails

- This repository change does not provision, modify or delete cloud resources.
- No production Render resource, database, secret, DNS record or deployment is changed.
- No production database backup or customer data is copied.
- Do not run `terraform apply`, deploy workflows, database migrations or DNS changes without the relevant explicit approval.
- Keep Render available as rollback until AWS production acceptance and cutover are complete.
