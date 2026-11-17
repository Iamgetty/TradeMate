# TradeMate third-party integration register

**Purpose:** canonical procurement and implementation inventory for every named external software provider, platform, data source and infrastructure service discussed in the TradeMate roadmap. This register is a planning control, not a statement that every provider is selected, contracted, configured, or deployed.

**Status definitions**
- **In use / code present:** source code or current service configuration shows an integration or dependency; production acceptance may still be outstanding.
- **Current platform:** presently used to host, build, deploy or operate TradeMate.
- **Planned direction:** architecture or product direction is recorded, but deployment/procurement is not complete.
- **Evaluate:** candidate only; no vendor selection or contract implied.
- **Alternative:** competing implementation option; do not deploy in parallel by default.
- **Placeholder / not connected:** UI or product intent exists without a working external integration.
- **Not selected:** capability is required or anticipated, but no vendor has been chosen.

## Identity, KYC, KYB and financial-crime controls

TradeMate is a global contract marketplace. Identity and business verification must support African markets and global markets, with country-by-country evidence rather than relying on headline country counts.

| Provider | Capability | Register status | Selection / acceptance gate |
|---|---|---|---|
| Sumsub | Global individual KYC, business KYB, beneficial-owner checks and AML workflows | **Evaluate — preferred first candidate, not selected** | Demonstrate actual person/document and company-registry coverage by country; verify directors/UBOs, non-standard entities, manual fallback, data residency, retention, pricing, SLA and webhook security. |
| Veriff | Individual identity verification and business verification | **Evaluate — challenger** | Benchmark document coverage, liveness/biometric performance, fraud controls, KYB jurisdiction depth and commercial terms against Sumsub. |
| Trulioo | Global identity and business registry/data verification | **Evaluate — KYB challenger** | Validate registry-source depth, ownership data, entity types, African coverage and fallback evidence per country. |
| Moody's | Corporate/entity intelligence, ownership and risk data | **Evaluate — specialist due-diligence option** | Assess whether deeper corporate intelligence is needed beyond primary KYB; verify source freshness, licensing, geography and costs. |
| Smile ID | African identity verification | **Evaluate — regional fallback candidate** | Assess country/document coverage and use only where it materially improves coverage or outcomes; not the global default. |
| Dojah | African identity and compliance APIs | **Evaluate — regional fallback candidate** | Validate exact country and product coverage, registry access, reliability, security and data terms. |
| Onfido / Entrust | Identity verification | **Evaluate — existing roadmap candidate** | Reassess against Sumsub, Veriff and Trulioo using the same global test matrix; do not assume selected. |
| KYC/KYB provider-neutral adapter | TradeMate integration boundary for provider routing, normalized decisions, evidence references and audit history | **Planned — required architecture** | Keep user identity attached to the user and business verification attached to the organization; support multiple providers and manual review. |
| Email delivery provider | Registration verification and transactional email | **Not selected** | Existing email verification code/provider configuration must be audited; select based on deliverability, global reach, security, data processing, templates, webhooks and cost. |

**Global KYB acceptance rule:** a provider's advertised country count is not sufficient. Maintain a country-by-country matrix for company registry lookup, legal existence/status, directors, shareholders/beneficial owners, representative authority, address, document-based fallback and manual review. Include African countries and less-digitized registries. Do not block an otherwise supported country solely because an automated registry API is unavailable; use a documented risk-based manual/document workflow where legally permissible.

**Registration product rule:** individual onboarding runs KYC against the user; business onboarding runs KYB against the organization and KYC against the registering representative. Verify directors/beneficial owners where required by jurisdiction, legal form and risk. A business certificate alone is not proof of representative authority or beneficial ownership.

## Marketplace, trading and external data integrations

| Provider / software | Product area | Register status | Acceptance / notes |
|---|---|---|---|
| MetaTrader 5 (MT5) | Forex platform connectivity | **In use / code present — integration foundation** | Validate live connectivity and quote freshness; MT5 is a platform integration, not proof of brokerage execution or custody. |
| Exness | Forex / MT5 quote source | **In use / code present — acceptance outstanding** | Verify live provider availability, credentials, freshness, reconnect and fallback behaviour. |
| Binance | Crypto spot market data | **In use / code present** | Verify feed freshness, reconnect, rate limits and symbol mapping; no implication of user trading/custody. |
| Bybit | Crypto spot/derivatives market data | **In use / code present** | Verify feed freshness, reconnect, rate limits and symbol mapping; market-data integration only. |
| Twelve Data | Financial/market data | **In use / code present** | Verify plan limits, permitted use, coverage, freshness and fallback. |
| OpenSea | NFT collection/item data | **In use / code present** | Verify API access, rate limits, attribution, collection coverage and failure handling. |
| OANDA | Forex data/provider | **Not configured / excluded from current Forex foundation** | Current roadmap says no OANDA credentials; do not imply active integration. Reconsider only through explicit provider decision. |

## Cloud, hosting, delivery and developer platform

AWS is the approved primary-cloud direction with Cloudflare at the edge. GCP is optional, not a parallel default stack. Render remains the current hosting/database platform until a separately approved and verified migration.

| Provider / service | Purpose | Register status | Notes / alternatives |
|---|---|---|---|
| Render | Current web/API/feed hosting and managed PostgreSQL | **Current platform** | Verify each service/deploy independently; retain until migration is approved and proven. |
| GitHub / GitHub Actions | Source control, CI and deployment workflows | **Current platform** | Protect main, exact-head CI, reviewed changes and deployment provenance. |
| AWS | Primary cloud direction | **Planned direction** | No migration or provisioning implied. |
| Cloudflare | DNS, WAF, DDoS, bot and edge security | **Planned direction** | Define clear ownership with CDN and origin routing. |
| Amazon CloudFront | CDN | **Planned direction** | AWS target; cache only approved public assets/content. |
| Amazon RDS for PostgreSQL / Aurora PostgreSQL | Managed PostgreSQL | **Planned alternatives** | Select one based on compatibility, operational needs, cost and regional availability. |
| Amazon ECS / Fargate | Managed application compute | **Planned candidate** | Preferred simpler compute candidate; validate workload fit. |
| Amazon EKS | Kubernetes compute | **Alternative** | Do not choose by default unless measured operational requirements justify Kubernetes. |
| Amazon ElastiCache (Redis/Valkey) | Cache and coordination | **Planned candidate** | Never source of truth for contracts, audit history or financial records. |
| Amazon SQS | Durable queues | **Planned candidate** | Select semantics per asynchronous workload. |
| Amazon SNS | Pub/sub notifications | **Planned candidate** | Use only where fan-out semantics justify it. |
| Amazon EventBridge | Event routing/scheduling | **Planned candidate** | Avoid duplicate event infrastructure without a use case. |
| Amazon S3 | Private object/media storage | **Planned candidate** | Requires access control, encryption, signed URLs, malware scanning and retention/deletion policy. |
| AWS Secrets Manager | Secrets management | **Planned candidate** | Prefer workload identity and rotation; never store secrets in source. |
| AWS Systems Manager Parameter Store | Configuration/parameter management | **Planned candidate** | Distinguish secrets from non-secret configuration. |
| AWS API Gateway WebSocket | Managed WebSocket gateway | **Evaluate — AWS option** | Compare with ALB-fronted ECS/Fargate for long-lived connections, auth, fan-out, cost and limits. |
| Google Cloud Platform (GCP) | Optional cloud alternative | **Alternative only** | Not a parallel default production platform. |
| Cloud Run | Managed compute | **GCP alternative** | Evaluate only if a measured case warrants GCP. |
| Google Kubernetes Engine (GKE) | Kubernetes compute | **GCP alternative** | Not default. |
| Cloud SQL for PostgreSQL | Managed PostgreSQL | **GCP alternative** | Alternative to RDS/Aurora. |
| Google Cloud CDN | CDN | **GCP alternative** | Alternative to CloudFront. |
| Memorystore | Redis-compatible cache | **GCP alternative** | Alternative to ElastiCache. |
| Pub/Sub | Messaging | **GCP alternative** | Alternative to AWS event/queue services depending on semantics. |
| Cloud Tasks | Managed task queues | **GCP alternative** | Alternative for task-delivery workloads. |
| Cloud Storage | Object storage | **GCP alternative** | Alternative to S3. |
| Secret Manager | Secrets management | **GCP alternative** | Alternative to AWS secrets services. |

## Security, compliance, audit and legal assurance

All names below are procurement/evaluation candidates unless separately evidenced as active. No engagement, certification or audit is implied.

| Provider / software | Purpose | Register status | Notes |
|---|---|---|---|
| Chainalysis | Blockchain wallet/address screening and transaction monitoring | **Evaluate — conditional** | Only before any legally approved crypto-transfer or wallet-risk workflow. |
| TRM Labs | Blockchain risk and transaction monitoring | **Evaluate — conditional** | Compare coverage, false positives, case management and jurisdiction fit. |
| Elliptic | Blockchain analytics and screening | **Evaluate — conditional** | Compare against Chainalysis and TRM Labs; no need to buy all three by default. |
| NCC Group | Independent security assessment / penetration testing | **Evaluate** | RFP, independence, scope, references, retest and cost. |
| Trail of Bits | Application, cryptography and smart-contract security | **Evaluate** | Specialist scope; smart-contract audit only if on-chain code is introduced. |
| Halborn | Blockchain and application security audits | **Evaluate** | Verify relevant scope and technical team. |
| Stingrai | Security assessment | **Evaluate** | Verify current capabilities, references and scope before procurement. |
| OWASP ZAP | Automated web/API security testing | **Evaluate / planned tooling** | Run safely in non-production; authenticated DAST requires controlled test accounts. |
| A-LIGN | SOC 2 audit/readiness | **Evaluate** | Verify auditor eligibility, scope, independence and report terms. |
| Schellman | SOC 2 audit/readiness | **Evaluate** | Compare with A-LIGN and qualified Big Four practices. |
| Big Four firms | Regulatory, SOC 2 readiness and assurance advisory/audit | **Evaluate as firm category** | Select a specific eligible practice through RFP; not a single vendor selection. |

## Account linking and community platforms

| Provider | Purpose | Register status | Notes |
|---|---|---|---|
| Google OAuth | External account linking | **Placeholder / not connected** | UI state is not an OAuth integration; requires consent, secure token handling and account-linking controls. |
| Telegram | Account linking/community | **Placeholder / not connected** | Distinguish community links from authenticated account linking. |
| X | Account linking/community | **Placeholder / not connected** | Distinguish community links from authenticated account linking. |

## Not yet selected / explicit capability gaps

- **KYC/KYB:** shortlist above; no provider selected or integrated for identity verification. Current three-step KYC UI is not a working verification service.
- **Email delivery:** provider must be confirmed from production configuration and deliverability evidence; do not infer a provider from email-verification code.
- **Payments / fiat rails / escrow:** no provider selected. Do not add until product scope, funds flow, licensing, custody responsibilities and jurisdictional legal advice are approved.
- **Wallet custody / deposits / transfers:** no custody, deposit, transfer or withdrawal provider is integrated. No withdraw feature should be represented as available.
- **Business registry fallback:** determine country-specific official sources and acceptable documentary/manual procedures where vendor coverage is incomplete.
- **Electronic signatures:** no e-signature vendor selected; contract agreement workflow must not be described as legally e-signed.
- **SMS / voice OTP:** no provider selected; assess only if a product requirement calls for it.

## Mandatory build-time control: no integration gets skipped

Before resuming feature implementation, and whenever a new feature is planned:
1. Search this register and the current codebase/roadmap for an existing provider, SDK, API client, webhook, secret/config key or UI placeholder.
2. Classify every dependency as current/in-use, partially implemented, planned, candidate, alternative, placeholder or not selected.
3. Confirm country/jurisdiction coverage, data categories, data residency, retention/deletion, subprocessors, security controls, outage/fallback behaviour, pricing and contractual terms.
4. Record the product owner, technical owner, integration point, credential/configuration requirements (names only), test plan, acceptance evidence and renewal/cost owner before implementation.
5. Add provider contract tests, webhook signature/replay tests, timeout/retry/rate-limit tests, privacy/security review and operational monitoring as appropriate.
6. Update this register and cross-reference the relevant roadmap workstream in the same PR that adds or changes an integration.
7. Never describe a candidate as selected, an SDK as a complete integration, a CI pass as live acceptance, or a planned cloud service as deployed.

**Review gate:** this register must be checked during every future TradeMate build session before selecting the next task. The list is deliberately comprehensive based on providers and services currently named in the roadmap and project discussions; it must be extended when repository inspection or a new product decision identifies another dependency.
