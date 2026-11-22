# TradeMate cloud platform roles

**Status:** cost-constrained architecture direction; EC2 reuse remains provisional and no new cloud resources are authorized by this document.

## Primary platform responsibilities

> **Cost decision (22 November 2026):** ECS/Fargate has been removed from the active migration roadmap because it adds recurring compute and related infrastructure costs. Do not execute ECS/Fargate change sets or provision new paid AWS resources without a separate explicit budget approval. The existing EC2-hosted API/feed option is provisional pending capacity and security validation; Render remains online until an alternative is verified.

- **Cloudflare is the primary frontend host.** The Next.js application is targeted for Cloudflare Workers after adapter compatibility, authentication, routing and runtime acceptance gates pass. Cloudflare owns frontend delivery, DNS/routing, TLS and edge security.
- **AWS is the existing backend/data platform, subject to a strict no-new-cost constraint.** Reuse the already-provisioned EC2 host and RDS only if capacity, security and operational acceptance pass. ECS/Fargate, EKS, ALB, NAT Gateway and other new billable infrastructure are not approved targets; their templates are retained only as dormant design artifacts.
- **Render remains secondary** for staging, testing, QA and pre-release validation. It is not the production source of truth.
- **Google Cloud Platform (GCP) is recognized as an additional cloud platform** in TradeMate's architecture and longer-term cloud strategy. AWS remains the selected primary platform for the initial backend migration. GCP is not being deployed as a duplicate primary production stack in this phase; any GCP workload or service requires a separately documented use case, architecture, security/data-flow review, operating ownership and approved budget.
- **Amazon CloudFront is optional, not the primary frontend host.** It may serve selected public/static assets from AWS origins such as S3 if measured performance, geographic delivery or origin requirements justify a separate distribution. Do not put CloudFront in front of the Cloudflare Workers frontend by default. Avoid double-proxying the same frontend hostname. Keep authenticated APIs, private downloads and user-specific responses out of public shared caches.

## GCP evaluation gate

For any proposed GCP workload, document why it belongs on GCP rather than AWS or Cloudflare, the exact service and data processed, identity and least-privilege model, network exposure, data residency and cross-cloud transfer, secrets, event delivery/retries/idempotency where relevant, observability/on-call ownership, failure modes, vendor dependency and ongoing cost. Do not move core API functions, authoritative business state or primary database access to GCP by default. Do not create GCP resources or incur charges without separate explicit approval.

## CloudFront evaluation gate

Before creating a CloudFront distribution, identify the exact AWS origin and asset class, prove the content is safe for shared caching, define cache keys/TTL/invalidation and origin access controls, and document which platform owns the hostname, TLS and cache layer. Cloudflare remains the primary frontend host and edge platform regardless of whether a separate CloudFront distribution is approved for AWS-origin assets.

## Safety and rollout boundaries

This is an architecture decision record only. It does not provision AWS or GCP resources, configure DNS, change production routing, move data, create CloudFront distributions, change billing, or authorize production cutover. Any provisioning, paid resource creation or production change requires separate explicit approval.
