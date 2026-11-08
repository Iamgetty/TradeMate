# AWS staging foundation (CloudFormation)

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
- A private Cloudflare Tunnel connector ECS service (two tasks by default) with a dedicated security group and execution role that can read only its tunnel token secret. The API execution role can read only its database URL and TOTP secret; the one-off migration task has a separate execution role that can read only its migrator secret. Application, connector and migration task roles receive no additional AWS permissions by default.
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

- The template is region-agnostic. `us-west-2` remains a proposed staging region, not an approved deployment decision.
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
