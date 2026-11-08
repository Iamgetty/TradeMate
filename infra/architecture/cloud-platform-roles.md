# TradeMate cloud platform roles

**Status:** approved target architecture; implementation is in progress and no new cloud resources are authorized by this document.

## Primary platform responsibilities

- **Cloudflare is the primary frontend host.** The Next.js application is targeted for Cloudflare Workers after adapter compatibility, authentication, routing and runtime acceptance gates pass. Cloudflare owns frontend delivery, DNS/routing, TLS and edge security.
- **AWS is the primary backend and data platform for the initial migration.** The initial target is ECS Fargate for the NestJS API and exchange-feed service, RDS for PostgreSQL, S3 where appropriate, Secrets Manager/KMS and CloudWatch.
- **Render remains secondary** for staging, testing, QA and pre-release validation. It is not the production source of truth.
- **Google Cloud Platform (GCP) is recognized as an additional cloud platform** in TradeMate's architecture and longer-term cloud strategy. AWS remains the selected primary platform for the initial backend migration. GCP is not being deployed as a duplicate primary production stack in this phase; any GCP workload or service requires a separately documented use case, architecture, security/data-flow review, operating ownership and approved budget.
- **Amazon CloudFront is optional, not the primary frontend host.** It may serve selected public/static assets from AWS origins such as S3 if measured performance, geographic delivery or origin requirements justify a separate distribution. Do not put CloudFront in front of the Cloudflare Workers frontend by default. Avoid double-proxying the same frontend hostname. Keep authenticated APIs, private downloads and user-specific responses out of public shared caches.

## GCP evaluation gate

For any proposed GCP workload, document why it belongs on GCP rather than AWS or Cloudflare, the exact service and data processed, identity and least-privilege model, network exposure, data residency and cross-cloud transfer, secrets, event delivery/retries/idempotency where relevant, observability/on-call ownership, failure modes, vendor dependency and ongoing cost. Do not move core API functions, authoritative business state or primary database access to GCP by default. Do not create GCP resources or incur charges without separate explicit approval.

## CloudFront evaluation gate

Before creating a CloudFront distribution, identify the exact AWS origin and asset class, prove the content is safe for shared caching, define cache keys/TTL/invalidation and origin access controls, and document which platform owns the hostname, TLS and cache layer. Cloudflare remains the primary frontend host and edge platform regardless of whether a separate CloudFront distribution is approved for AWS-origin assets.

## Safety and rollout boundaries

This is an architecture decision record only. It does not provision AWS or GCP resources, configure DNS, change production routing, move data, create CloudFront distributions, change billing, or authorize production cutover. Any provisioning, paid resource creation or production change requires separate explicit approval.
