# AWS backend and Cloudflare frontend foundation

> **Superseded cost decision — 22 November 2026:** ECS/Fargate is removed from the active TradeMate migration roadmap because it adds recurring cost. The ECS/Fargate, ALB, NAT Gateway and related CloudFormation templates/workflows in this directory are retained as historical, un-deployed design artifacts only. **Do not execute either existing change set or provision any of these resources.** The current investigation is limited to Cloudflare Workers for the web frontend and potential reuse of the existing EC2 host plus existing RDS for backend workloads, subject to capacity/security acceptance. Keep Render online until a replacement is fully tested and explicitly approved. No new paid AWS resource is authorized.

## Current verified staging state (25 November 2026)

The following is a live status snapshot, not production approval:

- Cloudflare Workers `trademate-staging` is the Worker currently attached to `trademate.cfd` and `www.trademate.cfd`. Both domains are enabled and tested with HTTP 200.
- Staging workers.dev URL: `https://trademate-staging.trademate-web.workers.dev`; homepage and API proxy acceptance pass.
- A separate Worker named `trademate` is built with the same API-origin binding and tested at `https://trademate.trademate-web.workers.dev`. It is a candidate only; custom domains remain on `trademate-staging`.
- The API is running on the existing EC2 staging host under systemd `trademate-api.service`, release `bf0f6ef7f340ee8274c30c7883b8dbc6cef499f0`. The health route returns HTTP 200. Feed service health is HTTP 200.
- API runtime email code now uses the TradeMate sender name and the custom-domain logo URL; the compiled release was checked on-host. The logo route returns a valid PNG.
- Latest exact-head TradeMate CI, PostgreSQL compatibility, API deployment, and Cloudflare staging smoke runs passed. Browser acceptance passed 8/8 on both staging and the production Worker candidate.
- The MT5 quote collector remains local CSV-only by default. The staging feed's ingestion token and runtime configuration are **not** yet in place, so do not enable collector uploads or public quote broadcast.

No production custom-domain cutover, production data migration, MT5 quote upload, or public quote redistribution is approved by this snapshot.

## Architecture decision

TradeMate uses a split-cloud architecture:

- **Existing AWS resources are a candidate backend/data platform**, subject to a no-new-cost constraint and capacity/security acceptance. No new ECS/Fargate or paid networking resources are approved.
- **Cloudflare hosts and serves the frontend** and provides DNS, WAF, DDoS protection and edge traffic controls.
- **Render is retained as a secondary environment for staging, testing, QA and pre-release validation**. It is not the production source of truth or the primary production rollback platform.
- **Google Cloud Platform (GCP)** is recognized in TradeMate's longer-term cloud strategy. AWS remains the primary backend/data platform for the initial migration; GCP is not a duplicate primary production stack in this phase. Any GCP workload requires a separately documented use case, security/data-flow review, operational owner and approved budget.

This directory contains historical AWS backend staging design artifacts. The ECS/Fargate deployment path is not the active roadmap and must not be provisioned under the current no-new-cost decision. The existing-EC2 alternative is still under investigation and is not approved for cutover. This documentation change does not provision or modify cloud resources.

## Workload placement

| Existing workload | Target platform |
|---|---|
| `trademate-web` (Next.js 16, React 19) | Cloudflare Workers; evaluate vinext (Cloudflare's current recommended path for Next.js 16+) against the OpenNext adapter using compatibility and production-build tests before choosing; Cloudflare serves the frontend and static assets |
| `trademate-api` (NestJS, Node.js) | Existing EC2 host via existing Cloudflare Tunnel — provisional; capacity and security acceptance required |
| `exchange-feed` (Node.js WebSocket service) | Existing EC2 host via existing Cloudflare Tunnel — provisional; capacity and WebSocket acceptance required |
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
- Use immutable container images in ECR, referenced by sha256 digest; retain the source commit SHA as release metadata. GitHub Actions builds/tests/scans and deploys backend staging only after required checks pass.
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

### Gated staging image build and signed provenance

The repository includes `.github/workflows/aws-staging-build-images.yml` as a manual, `main`-only image publisher. It accepts only the exact current `main` commit SHA, checks the required CI, browser acceptance, migration integration, security, Cloudflare, lockfile and CloudFormation validations for that SHA, then builds the API and exchange-feed images from that checkout. It resolves the ECR repository URIs from the stable `trademate-staging-foundation` stack rather than accepting caller-supplied repository names. It pushes uniquely tagged images to the immutable ECR repositories, emits BuildKit maximum-detail provenance and an SBOM, creates a GitHub-signed SLSA provenance attestation for each image digest, and verifies the attestation against this repository, the exact publishing workflow, `refs/heads/main` and the source commit before reporting the digest.

Before enabling it, configure the GitHub Environment named `aws-staging-image-publish` with required reviewers, prevent self-review where supported, restrict deployment branches to `main`, and add non-secret environment variables `AWS_STAGING_PUBLISH_ROLE_ARN` and `AWS_STAGING_ACCOUNT_ID`. Its OIDC trust policy must be restricted to this repository, the `aws-staging-image-publish` environment subject and the expected GitHub Actions audience. Grant only foundation-stack read access, ECR authentication and push permissions for `trademate/api` and `trademate/exchange-feed`; do not grant ECS deployment, task registration, IAM pass-role or database permissions to this publisher role. No long-lived AWS keys belong in GitHub.

The staging migration workflow independently verifies the API image's signed attestation against the expected signer workflow and exact source commit before it registers or runs the migration task. The GitHub attestation is retrieved from GitHub's attestation service; the image itself is pulled/resolved from ECR. This provides a cryptographic image-to-source binding, but it does not by itself prove that AWS accepted the task, that the migration succeeded, or that the API is safe to promote. The build/publish workflow has not yet been run against AWS; repository implementation and static CI validation must not be described as a completed staging rehearsal.

### Gated staging migration execution

The repository includes `.github/workflows/aws-staging-migration-task.yml` as a manual, staging-only pre-migration step. It is deliberately separate from service deployment and does not promote or update the API service. The operator supplies the next release's tested API image digest before the services stack is updated; the workflow registers a one-off task-definition revision from the reviewed migration task configuration with that new image, then runs it. Only after the migration and staging acceptance succeed should a separately reviewed services-stack update promote the API image.

Before enabling it, configure the GitHub Environment named `aws-staging-migrations` with required reviewers, prevent self-review where supported, restrict deployment branches to `main`, and add the non-secret environment variables `AWS_STAGING_DEPLOY_ROLE_ARN` and `AWS_STAGING_ACCOUNT_ID`. The OIDC trust policy for that role must be restricted to this repository, the `aws-staging-migrations` environment subject, and the expected GitHub Actions audience. Do not use long-lived AWS access keys.

The workflow requires an explicit `yes` confirmation, the full ECR API image URI pinned by SHA-256 digest, and the source commit SHA. It requires the operator-supplied source commit to exactly equal the `main` SHA that dispatched the workflow, preventing a migration task from running an older image after `main` has advanced, and verifies that the named CI, Cloudflare compatibility and lockfile check runs for that exact commit all concluded successfully. CloudFormation and workflow linting are enforced separately whenever infrastructure or workflow files change. The workflow also verifies a GitHub-signed SLSA provenance attestation for the exact ECR image digest, requiring this repository's `.github/workflows/aws-staging-build-images.yml` signer, the `main` source ref and the exact supplied source commit digest. The source SHA is therefore bound to the image by a verified attestation rather than trusted as operator-supplied metadata alone. The workflow requires both CloudFormation stacks to be stable (`CREATE_COMPLETE` or `UPDATE_COMPLETE`), then resolves the baseline migration task definition, cluster, private subnets, migration-only security group, secret ARN and IAM role ARNs from stack outputs. It validates the baseline task command and security references, confirms the requested image digest exists in ECR, registers a new task-definition revision using that image, and refuses to start if another migration task is pending or running. It launches one Fargate task without a public IP, observes task state for up to 25 minutes, and requires a successful container exit code. On observation timeout it does not force-stop the task; inspect the still-running task before any retry. The summary records the source SHA, image digest, registered task-definition ARN and ECS task ARN; secret values and migration logs are not printed.

Scope the GitHub OIDC role to the staging account and minimum required actions: `cloudformation:DescribeStacks` on the two named stacks; `ecs:DescribeTaskDefinition`, `ecs:RegisterTaskDefinition` (restricted to the migration task-definition family), `ecs:ListTasks`, `ecs:RunTask` (restricted to the intended cluster and task-definition family), and `ecs:DescribeTasks`; `ecr:DescribeImages` for the approved image repository, `ecr:GetAuthorizationToken` (resource `*` as required by ECR), and read-only image access (`ecr:BatchGetImage`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchCheckLayerAvailability`) for that repository so GitHub CLI can resolve the OCI subject while verifying signed provenance; and `iam:PassRole` only for the two migration task roles with `iam:PassedToService=ecs-tasks.amazonaws.com`. Constrain `ecs:RunTask` to the intended cluster/task definition and constrain `iam:PassRole` to the exact ECS task roles with `iam:PassedToService=ecs-tasks.amazonaws.com`. The ECS task execution role—not the GitHub role—reads the migration secret. The task's dedicated migration security group is the only security group attached by the workflow.

This workflow is not an end-to-end release orchestrator: API promotion, traffic shifting, post-migration acceptance, rollback and release-record creation remain separate work. Do not infer that a successful migration task makes the API release safe to promote. The workflow has not been executed against AWS; environment protection, OIDC trust, IAM policy, stack outputs, database connectivity and migration-task behavior remain unverified until a separately approved staging rehearsal succeeds. The AWS validation workflow runs `actionlint` across the repository's GitHub Actions definitions as well as `cfn-lint` across the staging templates.

### Gated staging API promotion after migration

The repository includes `.github/workflows/aws-staging-api-promotion.yml` as a separate, manual, `main`-only promotion step. The migration workflow uploads a short-lived, non-secret handoff artifact only after the one-off task has stopped with container exit code 0. The promotion workflow requires the migration run ID and the exact API image digest, verifies that the referenced run is a successful main-branch execution of the expected migration workflow, downloads its handoff artifact, and checks that the artifact binds the same run ID and run attempt, source SHA, task ARN and digest supplied by the operator. The upload overwrites the prior artifact on a rerun, and promotion rejects artifacts from an earlier attempt. It also requires the artifact source SHA to match both the migration run's head SHA and the current `main` head, rejecting stale release handoffs.

Before enabling it, configure the GitHub Environment named `aws-staging-api-promotion` with required reviewers, prevent self-review where supported, restrict deployment branches to `main`, and add `AWS_STAGING_PROMOTE_ROLE_ARN` and `AWS_STAGING_ACCOUNT_ID`. Its OIDC trust policy must be restricted to this repository, this environment subject and the GitHub Actions audience. The promotion role must be separate from both the image-publisher and migration-runner roles. Scope it to the staging services/foundation stack reads and change-set operations, ECR image inspection and read-only OCI access (plus `ecr:GetAuthorizationToken`), ECS service/task-definition reads, ALB target-health reads, and `iam:PassRole` only for the API task's existing execution/task roles with `iam:PassedToService=ecs-tasks.amazonaws.com`. Do not grant database-secret access, migration task execution, feed-service changes or production access.

The workflow verifies the GitHub-signed image provenance again, confirms the API task definition contains only the runtime `DATABASE_URL`, `RLS_CONTEXT_HMAC_KEY` and `TOTP_ENCRYPTION_KEY` secrets, and requires the ECS deployment circuit breaker with rollback enabled. It creates a CloudFormation change set using the previous services template and only changes `ApiImageUri`; before execution it rejects any change set that is not limited to the API task definition and API service. After execution it waits for CloudFormation and ECS service stability, confirms the service uses the exact attested digest, and requires the ALB target group to have at least the desired number of healthy targets. This avoids an unmanaged ECS task-definition update and keeps CloudFormation as the owner of the deployed service state.

This workflow is a repository implementation, not deployment acceptance. It has not been run against AWS. Environment reviewers, OIDC trust, role policy, change-set behavior, rollback, target health and the staging promotion rehearsal remain unverified. It does not promote production or change DNS/Cloudflare routing.

## Blocking inputs for provisioning

- AWS account ID and confirmation that the account is ready for TradeMate.
- `eu-north-1` is the selected AWS staging target region; actual provisioning still requires separate approval.
- AWS access path: preferably GitHub Actions OIDC with a narrowly scoped staging deployment role; do not send access keys or secrets in chat.
- Monthly AWS staging budget ceiling and desired RDS/ECS availability profile.
- Cloudflare account access and an approved staging hostname/zone for the frontend deployment. Do not share API tokens in chat; use a secure secret-management flow.

## Guardrails

- No new AWS stacks, paid AWS infrastructure, database migrations, or production data transfers were created or run during the current staging work.
- The existing EC2 staging API/feed host was used for the already-established staging deployment path.
- Cloudflare Worker code/bindings and staging domain attachment were changed during this staging work. Current custom domains `trademate.cfd` and `www.trademate.cfd` remain attached to `trademate-staging`; the separately tested `trademate` Worker candidate is not attached to those custom domains.
- No production custom-domain cutover is authorized by the staging acceptance. Do not move custom domains, migrate production data, shut down Render, rotate production secrets, or run production migrations without separate explicit approval.
- No production database backup or customer data was copied.
- Keep Render available until a replacement has been fully tested and explicitly approved; do not silently synchronize production data/secrets.

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
- API and feed ECR image URIs pinned by sha256 digest; record the source commit SHA alongside each digest in release metadata.
- A separate migrator-role database URL secret ARN for `MigrationDatabaseUrlSecretArn`; never reuse the master or application-role secret.
- A Cloudflare Tunnel token secret ARN for `CloudflareTunnelTokenSecretArn`, plus a `CloudflaredImageUri` pinned to an immutable image digest. The connector runs in private subnets and requires outbound connectivity through NAT.
- An ACM certificate in the same AWS region covering both staging hostnames, plus the exact API/feed hostnames and Cloudflare staging frontend origin.
- A Secrets Manager secret whose SecretString is the complete API `DATABASE_URL`, a separate secret whose SecretString is the 64-character hex `TOTP_ENCRYPTION_KEY`, a third, distinct secret whose SecretString is the migrator-role PostgreSQL URL (`MIGRATION_DATABASE_URL`), and a fourth 64-character hex secret for `RLS_CONTEXT_HMAC_KEY`. The API task receives the app database URL, TOTP key and HMAC key; the one-off migration task receives only the migrator URL and HMAC key. Do not put secret values in CloudFormation parameters, GitHub, or chat. For the first pass, use the AWS-managed Secrets Manager key unless a separately reviewed customer-managed KMS key policy is provided.

The API's migration credential is intentionally **not** injected into the long-running API task, and the API execution role cannot read the migrator secret. The HMAC verifier secret is shared only between the API and one-off migration task execution roles. The database URL secret must use the least-privileged application DB role, not the migration/master role. The service template defines a standalone `MigrationTaskDefinition` using the exact digest-pinned API image and `node scripts/migrate.js`; it creates no ECS service and never runs migrations on API startup. To execute it later, an explicitly authorized operator must use ECS `RunTask` in the private app subnets, attach the dedicated `MigrationSecurityGroupId` output (not the API/feed SG), inject only the migrator secret through the task definition, and inspect the task exit code and logs before allowing an API rollout. The task definition is preparatory only: this PR does not invoke `RunTask`, create database roles, populate secrets or execute SQL. Complete a staging backup/restore rehearsal and review the migration plan before first execution. The foundation exposes a dedicated migration security group; only tasks launched with that group can use its additional PostgreSQL ingress. Do not attach it to either long-running service.

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


### RLS verifier secret prerequisite

Create a 32-byte random key encoded as 64 hexadecimal characters in AWS
Secrets Manager as the `RLS_CONTEXT_HMAC_KEY` secret. Pass its ARN as
`RlsContextHmacKeySecretArn` when deploying the services stack. The template
grants secret retrieval only to the API and one-off migration task execution
roles; the exchange-feed and Cloudflare tunnel tasks do not receive it. The
API and migration task must reference the same secret value. Before running
migration 050, a database administrator must install `pgcrypto` in the
database `public` schema. Rotate the secret only through a coordinated
migration/API release so no serving API task uses a key different from the
database verifier. Do not place the key in CloudFormation parameters, Git,
logs or task plaintext environment configuration.


## Existing AWS account integration (eu-north-1)

The staging account already contains a VPC, a private PostgreSQL RDS instance and an EC2 administration host. The foundation template has therefore been adapted to **reuse** those resources rather than create a second VPC or database.

Confirmed existing resources (21 November 2026):

| Resource | Existing ID / value |
|---|---|
| VPC | `vpc-09fcbb52e99d9ddf1` |
| VPC CIDR | `172.31.0.0/16` |
| Existing RDS | `trademate-db` |
| RDS security group | `sg-0b8c91288a83085e3` |
| Existing public-routed subnet for NAT placement | `subnet-0f0650548512fe17f` (eu-north-1a) |
| Existing RDS subnet A | `subnet-0f0650548512fe17f` (eu-north-1a) |
| Existing RDS subnet B | `subnet-0b06dab6a814e941d` (eu-north-1b) |
| Existing RDS subnet C | `subnet-0f2479f01e7482953` (eu-north-1c) |

The existing subnets occupy `172.31.0.0/20`, `172.31.16.0/20` and `172.31.32.0/20`. The new application subnet defaults are `172.31.48.0/24` in eu-north-1a and `172.31.49.0/24` in eu-north-1b. These ranges do not overlap the three inspected existing subnets. Recheck the full subnet inventory immediately before deployment; do not assume the ranges remain free if other infrastructure has been added.

The adapted `foundation.yaml` creates only:
- Two dedicated private application subnets and their dedicated route tables.
- One NAT Gateway and Elastic IP in the existing public-routed subnet.
- Private-subnet default routes through that NAT Gateway.
- ECS cluster, ECR repositories, log groups and workload security groups.
- Two narrowly scoped TCP/5432 ingress rules on the **existing** RDS security group, sourced only from the new API and migration security groups.

It does **not** create, replace, modify or delete the VPC, Internet Gateway, existing subnets, existing EC2 host, RDS instance or RDS subnet group. The pre-existing EC2-to-RDS security-group rule is preserved. Removing the foundation stack later would remove its two added RDS ingress rules; review stack deletion impact first.

### Required foundation stack parameters

Use these values only after a fresh AWS inventory confirms the IDs and CIDRs are unchanged:

- `ExistingVpcId=vpc-09fcbb52e99d9ddf1`
- `NatPublicSubnetId=subnet-0f0650548512fe17f`
- `ExistingDatabaseSecurityGroupId=sg-0b8c91288a83085e3`
- `ExistingDatabaseSubnetIds=subnet-0f0650548512fe17f,subnet-0b06dab6a814e941d,subnet-0f2479f01e7482953`
- `AppAvailabilityZoneA=eu-north-1a`
- `AppAvailabilityZoneB=eu-north-1b`
- `PrivateAppSubnetACidr=172.31.48.0/24`
- `PrivateAppSubnetBCidr=172.31.49.0/24`

**Cost and availability:** one NAT Gateway is a deliberate staging-cost compromise. Both private application subnets route through the NAT in eu-north-1a, so outbound connectivity is not AZ-independent. NAT Gateway hourly, data-processing and Elastic IP charges apply. This is required for the private Cloudflare Tunnel tasks to reach Cloudflare; S3 gateway access alone cannot provide general internet egress.

### Existing database: do not deploy database.yaml

`database.yaml` remains a reusable template for a separately approved, greenfield database build. It is **not part of this existing-account deployment path**. Do not create a `trademate-staging-database` stack from it: the account already has `trademate-db`, and creating another RDS instance would duplicate cost and data. The existing RDS subnet group and instance remain unchanged. The services and migration workflows must use the existing database endpoint and the already provisioned secret values.

No AWS resources have been created or modified by this repository change. CloudFormation deployment, NAT creation, security-group ingress changes, migrations, Cloudflare routing and traffic cutover remain separate gated operations.
