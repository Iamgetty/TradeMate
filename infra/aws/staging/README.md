# AWS staging foundation (CloudFormation)

This is an **un-deployed infrastructure template** for the first AWS staging foundation. Adding it to GitHub does not create AWS resources.

## Included

- One VPC with DNS enabled.
- Two public subnets, two private application subnets and two isolated database subnets across the first two Availability Zones in the selected region.
- Internet gateway and public routing.
- One NAT gateway by default for private application egress. Set `NatGatewayCount=2` to use one NAT gateway per AZ.
- Separate ALB, API, exchange-feed and PostgreSQL security groups. The database accepts TCP/5432 only from the API task security group.
- ECS cluster with Container Insights.
- Immutable ECR repositories with scan-on-push and 30-image lifecycle policies.
- CloudWatch log groups with 30-day retention.
- S3 gateway VPC endpoint.

## Deliberate exclusions

This first foundation does **not** create an ALB, listener, ECS task definitions/services, RDS instance, database credentials, IAM task/execution roles, Secrets Manager secrets, CloudFront distribution, or Cloudflare configuration. Those require workload-specific configuration and a separate review. No production hostname, DNS, frontend origin or Render service is modified.

The RDS security group and isolated database subnets are prepared, but no database is provisioned. API and feed images are built in CI only; this template does not push images or deploy containers.


## ECS service layer (services.yaml)

The separate `services.yaml` template consumes outputs/IDs from the network foundation and defines:

- An internet-facing ALB in the two public subnets, HTTP-to-HTTPS redirect, TLS listener and host-header routing for the API and exchange-feed hostnames.
- Separate IP target groups with application-matched health checks: API `GET /api/health` on port 4000 and feed `GET /health` on port 3000.
- Independent Fargate task definitions and services for the NestJS API and WebSocket exchange feed, with private-subnet tasks, no public IPs, deployment circuit breakers and CloudWatch logs.
- A narrowly scoped ECS execution role that can read only the two supplied runtime secret ARNs. The application task roles receive no additional AWS permissions by default.
- A 3,600-second ALB idle timeout for long-lived WebSocket connections and a 60-second feed target deregistration delay. Validate real connection lifetimes and graceful shutdown before increasing traffic.
- MT5 public broadcast remains explicitly disabled in the feed task until redistribution permission is confirmed.

### Required service-stack inputs

- VPC, public/private subnet, security-group and ECS cluster identifiers from the foundation stack outputs.
- Immutable API and feed image URIs tagged with a Git commit SHA.
- An ACM certificate in the same AWS region covering both staging hostnames, plus the exact API/feed hostnames and Cloudflare staging frontend origin.
- A Secrets Manager secret whose SecretString is the complete API `DATABASE_URL`, and a separate secret whose SecretString is the 64-character hex `TOTP_ENCRYPTION_KEY`. These are injected into the API task; do not put secret values in CloudFormation parameters, GitHub, or chat. For the first pass, use the AWS-managed Secrets Manager key unless a separately reviewed customer-managed KMS key policy is provided.

The API's migration credential is intentionally **not** injected into the long-running API task. The database URL secret must use the least-privileged application DB role, not the migration/master role. Migrations remain a separately authorized one-off ECS task/release step after the database role bootstrap and migration rehearsal are ready.

The services template does not create RDS, ACM certificates, DNS records, Cloudflare records, secret values, or images; it only references those prerequisites. Do not deploy until the exact staging hostnames, certificate, secrets, account permissions, region and cost are reviewed and separately approved.

## Network and cost choices

- The template is region-agnostic. `us-west-2` remains a proposed staging region, not an approved deployment decision.
- The default single NAT gateway lowers fixed staging cost but means private application egress from the second AZ depends on the NAT gateway in the first AZ and can incur cross-AZ transfer charges. Choose two NAT gateways for AZ-independent egress after reviewing cost.
- NAT gateways, Elastic IPs, VPC endpoints, ECS Container Insights and CloudWatch log ingestion can incur charges. Review the AWS pricing calculator and set a budget before deployment.
- Database subnets have no default internet route. Do not add public database access.
- VPC Flow Logs are not configured yet; add them with an approved retention and cost policy before production.

## Validate without deploying

```bash
python -m pip install cfn-lint
cfn-lint infra/aws/staging/foundation.yaml
```

A deployment review must additionally check CIDR overlap with existing VPCs/VPNs, selected-region AZ availability, quotas, NAT cost, security-group egress, endpoint requirements, CloudFormation change set and IAM permissions.

## Deployment boundary

Do not run `aws cloudformation deploy` from CI or a developer machine as part of validation. No stack should be created until AWS account/role permissions, target account and region, budget, and the exact change set have been reviewed and separately approved. This is staging-only; it does not authorize production infrastructure changes.
