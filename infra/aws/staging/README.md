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
