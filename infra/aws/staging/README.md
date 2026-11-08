# AWS backend and Cloudflare frontend foundation

## Architecture decision

TradeMate uses a split-cloud architecture:

- **AWS is the primary application and data platform** for production backend workloads.
- **Cloudflare hosts and serves the frontend** and provides DNS, WAF, DDoS protection and edge traffic controls.
- **Render is retained as a secondary environment for staging, testing, QA and pre-release validation**. It is not the production source of truth or the primary production rollback platform.
- **Google Cloud Platform (GCP)** is recognized in TradeMate's longer-term cloud strategy. AWS remains the primary backend/data platform for the initial migration; GCP is not a duplicate primary production stack in this phase. Any GCP workload requires a separately documented use case, security/data-flow review, operational owner and approved budget.

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
| Primary frontend deployment and edge delivery | Cloudflare Workers deployment pipeline, with Cloudflare-managed routing, TLS and edge controls |
| Optional AWS asset delivery | Amazon CloudFront may serve selected public/static assets from AWS origins such as S3 where justified; it does not replace Cloudflare or sit in front of the Cloudflare-hosted frontend by default |

Cloudflare's current guidance recommends vinext as the default path for Next.js 16+ on Workers, while documenting OpenNext as an alternative for applications that need it. vinext is in beta, so do not adopt it solely on the recommendation. Run its compatibility check and review the compatibility dashboard, then compare a staging build and runtime smoke tests against the OpenNext adapter. Preserve the existing Next.js build and Node.js deployment until one path passes. Validate the application's actual use of SSR, route handlers, middleware/proxy, image optimization, runtime APIs, server actions and Node-specific packages. Do not assume a static export is sufficient. Cloudflare Pages is not the default target for this SSR application; target Workers after the adapter decision is evidence-based.

The initial AWS staging target is **eu-north-1 (Europe/Stockholm)**, selected for the current deployment plan. This is a staging-region decision, not a final global production-region decision; validate latency, data-residency and operational requirements before production placement. The existing Frankfurt feed must be load-tested before deciding whether to keep it in a second region or consolidate it.

## Frontend compatibility audit findings

The existing frontend has several items that must be resolved or proven in an isolated Cloudflare staging build before the frontend can move:

- The catch-all same-origin API proxy at `TradeMate-main/apps/web/app/api/[...path]/route.ts` now reads the server-only `TRADEMATE_API_ORIGIN`; it no longer falls back to `NEXT_PUBLIC_API_URL` or the Render API hostname. An absent or invalid origin returns HTTP 503. Bind the AWS staging API origin only in the staging Worker environment, and keep production and Render endpoints separate.
- That proxy explicitly declares `runtime = 'nodejs'`. Validate the route under the chosen Workers adapter. It still explicitly declares `runtime = 'nodejs'`; do not remove that declaration or claim Workers compatibility until a real adapter build and runtime test proves it.
- The NFT route handlers (`app/api/nfts`, `app/api/nft-collection`, and `app/api/nft-collections`) read `OPENSEA_API_KEY` server-side. Preserve this as a server-only secret in the Cloudflare staging environment; never prefix it with `NEXT_PUBLIC_` or expose it to client bundles.
- These handlers use Next.js fetch extensions such as `next: { revalidate: ... }`, dynamic route configuration, and `AbortSignal.timeout`. Verify their caching and timeout semantics on Workers, including that user-specific API proxy responses remain uncached.
- A repository search did not find `next/headers` imports or `cookies()` calls in the frontend at the time of this audit. This is a scoped search result, not proof that all request-context or Node-specific dependencies are absent.

No cloud resources, environment secrets, routes or deployment settings were changed. The API proxy source was changed to remove the Render fallback; see the current route implementation for exact behaviour. The compatibility workflow is diagnostic only and does not initialize vinext or deploy a Worker.

## AWS backend staging topology

- Dedicated AWS account or isolated staging account under AWS Organizations; do not mix staging and production resources.
- VPC across at least two Availability Zones.
- Public subnets contain the internet gateway routing and NAT gateway egress components only.
- The Application Load Balancer is internal and resides in the private application subnets; ECS tasks also stay private, and RDS remains in isolated database subnets with no public endpoint.
- RDS PostgreSQL 18 compatibility must be verified against the exact extensions, collation, parameter settings and migration history used by TradeMate.
- Security groups allow ALB-to-service traffic and API-to-database traffic only. No broad database CIDRs.
- KMS encryption for RDS, logs and secrets; task roles use least-privilege IAM.
- Secrets Manager holds database credentials, TOTP encryption key and provider credentials. Never commit values or copy Render secret values into GitHub.
- CloudWatch log groups have explicit retention; alarms cover task health/restarts, ALB 5xx/latency, RDS storage/connections/CPU and deployment failures.
- Use immutable container images in ECR, tagged with the Git commit SHA. GitHub Actions builds/tests/scans and deploys backend staging only after required checks pass.
- Database migrations run as a one-off ECS task/release step, not automatically in every API replica's startup command.
- Preserve WebSocket upgrade behaviour, idle timeouts, health checks and graceful connection draining for the exchange feed.
- Before staging deployment, keep the proxy regression suite covering GET/HEAD and write methods, query-string/path forwarding, `accept`, `authorization`, `content-type`, `cookie` and `x-csrf-token` request-header forwarding, multiple `Set-Cookie` response headers, missing/invalid origin (503), upstream failure (502), redirects and no-store caching. The current proxy forwards those five request headers and preserves `content-type`, `location` and `content-disposition` response headers, plus multiple `Set-Cookie` values. Confirm whether additional headers (for example tracing/request IDs) are required by the API before staging; do not forward hop-by-hop headers. Configure the Cloudflare frontend's API origin, CORS allowlist, cookie domain/SameSite/Secure attributes, CSRF protections and authentication redirects deliberately. Do not expose private AWS service endpoints.
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
- `eu-north-1` is the selected AWS staging target region; actual provisioning still requires separate approval.
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

---

## AWS staging infrastructure templates

This is an **un-deployed infrastructure template** for the first AWS staging foundation. Adding it to GitHub does not create AWS resources.

## Included

- One VPC with DNS enabled.
- Two public subnets, two private application subnets and two isolated database subnets across the first two Availability Zones in the selected region.
- Internet gateway and public routing.
- One NAT gateway by default for private application egress. Set `NatGatewayCount=2` to use one NAT gateway per AZ.
- Separate internal ALB, Cloudflare Tunnel connector, API, exchange-feed, one-off migration and PostgreSQL security groups. The ALB accepts HTTPS only from the tunnel connector; the database accepts TCP/5432 only from API and dedicated migration task security groups.
- ECS cluster with Container Insights.
- Immutable ECR repositories with scan-on-push and 30-image lifecycle policies.
- CloudWatch log groups with 30-day retention.
- S3 gateway VPC endpoint.

## Deliberate exclusions

This network foundation does **not** create RDS, database credentials, Secrets Manager secrets, CloudFront distribution, or Cloudflare dashboard configuration. The separate services template creates an internal ALB, listeners, API/feed ECS services and a Cloudflare Tunnel connector service; it references pre-created secrets and an immutable cloudflared image. Those require workload-specific configuration and a separate review. No production hostname, DNS, frontend origin or Render service is modified.

The RDS security group and isolated database subnets are prepared, but no database is provisioned. API and feed images are built in CI only; this template does not push images or deploy containers.



## PostgreSQL layer (database.yaml)

The database template creates an encrypted, non-public RDS for PostgreSQL 18 instance in the two isolated database subnets, with a security group supplied by the foundation stack, automated backups, storage autoscaling, PostgreSQL/upgrade log exports and an AWS-managed master credential secret. The engine minor version is an explicit required parameter because supported versions vary by region. Verify the selected version and instance class with the AWS account/region before any deployment.

Staging defaults are intentionally cost-conscious: 20 GiB gp3, 7-day backups, single-AZ and deletion protection off. These are parameters, not production recommendations. The DB resource has snapshot deletion/update-replacement policies; do not delete or replace a populated database without a separately reviewed restore/retention plan. Enable Multi-AZ and deletion protection for longer-lived or production environments after cost and recovery review.

The RDS master secret is for controlled administration only. Do not inject it into the API task. The application requires separate `trademate_app`, `trademate_migrator` and `trademate_worker` credentials following the repository's database role bootstrap design. Create the roles and their credentials using a reviewed, one-off administrative procedure, then store the app role's full PostgreSQL connection URL in the Secrets Manager secret passed as `ApiDatabaseUrlSecretArn`. Keep migration and worker credentials separate; do not place them in the long-running API task. No database migration is run by this template.

## ECS service layer (services.yaml)

**Origin protection is now represented in the templates:** the ALB is internal, lives in private application subnets, and its security group accepts HTTPS only from the dedicated Cloudflare Tunnel connector security group. The connector runs as a private Fargate service with no public IP and reads its tunnel token from a dedicated Secrets Manager secret. The connector needs outbound NAT access to Cloudflare. This is infrastructure-as-code preparation only; Cloudflare dashboard routes, secrets, image digest and ACM certificate still need to be configured and validated before deployment.

The separate `services.yaml` template consumes outputs/IDs from the network foundation and defines:

- An internal ALB in the two private application subnets, HTTPS listener and host-header routing for the API and exchange-feed hostnames. It is not directly reachable from the public internet.
- Separate IP target groups with application-matched health checks: API `GET /api/health` on port 4000 and feed `GET /health` on port 3000.
- Independent Fargate task definitions and services for the NestJS API and WebSocket exchange feed, with private-subnet tasks, no public IPs, deployment circuit breakers and CloudWatch logs.
- A private Cloudflare Tunnel connector ECS service (two tasks by default) with a dedicated security group and execution role that can read only its tunnel token secret. The API execution role can read only its database URL and TOTP secret. The exchange-feed task has a separate baseline execution role and receives no API database or TOTP secret permissions. The one-off migration task has a separate execution role that can read only its migrator secret. Application, connector, feed and migration task roles receive no additional AWS permissions by default.
- A 3,600-second ALB idle timeout for long-lived WebSocket connections and a 60-second feed target deregistration delay. Validate real connection lifetimes and graceful shutdown before increasing traffic.
- MT5 public broadcast remains explicitly disabled in the feed task until redistribution permission is confirmed.

### Required service-stack inputs

- VPC, private application subnet, security-group and ECS cluster identifiers from the foundation stack outputs.
- Immutable API and feed image URIs tagged with a Git commit SHA.
- A separate migrator-role database URL secret ARN for `MigrationDatabaseUrlSecretArn`; never reuse the master or application-role secret.
- A Cloudflare Tunnel token secret ARN for `CloudflareTunnelTokenSecretArn`, plus a `CloudflaredImageUri` pinned to an immutable image digest. The connector runs in private subnets and requires outbound connectivity through NAT.
- An ACM certificate in the same AWS region covering both staging hostnames, plus the exact API/feed hostnames and Cloudflare staging frontend origin.
- A Secrets Manager secret whose SecretString is the complete API `DATABASE_URL`, a separate secret whose SecretString is the 64-character hex `TOTP_ENCRYPTION_KEY`, and a third, distinct secret whose SecretString is the migrator-role PostgreSQL URL (`MIGRATION_DATABASE_URL`). The first two are injected into the API task; the migrator secret is injected only into the one-off migration task. Do not put secret values in CloudFormation parameters, GitHub, or chat. For the first pass, use the AWS-managed Secrets Manager key unless a separately reviewed customer-managed KMS key policy is provided.

The API's migration credential is intentionally **not** injected into the long-running API task, and the API execution role cannot read the migrator secret. The database URL secret must use the least-privileged application DB role, not the migration/master role. The service template defines a standalone `MigrationTaskDefinition` using the API image and `node scripts/migrate.js`; it creates no ECS service and never runs migrations on API startup. To execute it later, an explicitly authorized operator must use ECS `RunTask` in the private app subnets, attach the dedicated `MigrationSecurityGroupId` output (not the API/feed SG), inject only the migrator secret through the task definition, and inspect the task exit code and logs before allowing an API rollout. The task definition is preparatory only: this PR does not invoke `RunTask`, create database roles, populate secrets or execute SQL. Complete a staging backup/restore rehearsal and review the migration plan before first execution. The foundation exposes a dedicated migration security group; only tasks launched with that group can use its additional PostgreSQL ingress. Do not attach it to either long-running service.

The services template does not create RDS, ACM certificates, DNS records, Cloudflare Tunnel/dashboard routes, secret values, or images; it only references those prerequisites. Configure two Cloudflare Tunnel public-hostname routes in the Cloudflare dashboard: API hostname to `https://` plus the internal ALB DNS name, and feed hostname to the same ALB. For each route set the origin Host header to its respective API/feed hostname and the TLS origin server name to that hostname so the ALB certificate validates. Confirm Cloudflare WebSocket proxying is enabled for the feed hostname. Do not disable TLS verification. Test API health, authentication, WebSocket upgrade/reconnect and long-lived connection behavior before accepting staging traffic. Do not deploy until the exact staging hostnames, certificate, secrets, account permissions, region and cost are reviewed and separately approved.

## Network and cost choices

- The template is region-agnostic. `eu-north-1` is the selected staging target; actual deployment remains subject to account access, cost review and separate provisioning approval.
- The default single NAT gateway lowers fixed staging cost but means private application egress from the second AZ depends on the NAT gateway in the first AZ and can incur cross-AZ transfer charges. Choose two NAT gateways for AZ-independent egress after reviewing cost.
- NAT gateways, Elastic IPs, VPC endpoints, ECS Container Insights and CloudWatch log ingestion can incur charges. Review the AWS pricing calculator and set a budget before deployment.
- Database subnets have no default internet route. Do not add public database access.
- VPC Flow Logs are not configured yet; add them with an approved retention and cost policy before production.
- The internal ALB and Tunnel connector are template-defined but not yet deployed or end-to-end verified. Do not deploy until the tunnel token, immutable cloudflared image digest, ACM certificate and Cloudflare hostname routes are ready and separately approved.
- The migration security group is a network permission boundary, not an authorization workflow by itself. A future one-off migration task must be manually/CI-authorized, run in private app subnets with that security group, receive only the migration credential, and be removed from the release path after successful completion. No migration task is created by this change.

## Validate without deploying

```bash
python -m pip install cfn-lint
cfn-lint infra/aws/staging/*.yaml
```

A deployment review must additionally check CIDR overlap with existing VPCs/VPNs, selected-region AZ availability, quotas, NAT cost, security-group egress, endpoint requirements, CloudFormation change set and IAM permissions.

## Deployment boundary

Do not run `aws cloudformation deploy` from CI or a developer machine as part of validation. No stack should be created until AWS account/role permissions, target account and region, budget, and the exact change set have been reviewed and separately approved. This is staging-only; it does not authorize production infrastructure changes.
