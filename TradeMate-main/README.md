# TradeMate by Metadusk

**Trade Smart. Trade Direct.**

TradeMate is a global, contract-first business platform in the Metadusk technology ecosystem. It connects individuals and organizations to discover opportunities, communicate, negotiate terms, establish business agreements and manage contract fulfilment across supported markets.

TradeMate retains its independent product identity. **Metadusk Inc.** is the intended parent-company identity and ecosystem; the public product endorsement is **TradeMate by Metadusk**.

## Product direction

- Services and B2B opportunities, alongside real estate, software, NFTs and market-information sections.
- A contract-centred workflow: counterparties discover one another, discuss an opportunity, negotiate scope and conditions, submit and review proposals, accept or decline terms, and confirm fulfilment.
- TradeMate is not a conventional product checkout or buy/sell exchange.
- TradeMate is not a cryptocurrency exchange or a spot/futures crypto trading platform. Crypto and Forex market information is distinct from the core contract workflow.
- Product listings and product-cart commerce are not part of the current product scope.
- P2P cryptocurrency offers and wallet-related capabilities are a separate later-stage workstream, not the definition of TradeMate.
- International use from day one, with country, currency, language and provider availability handled explicitly.

## Approved marketplace architecture

TradeMate's target marketplace structure is **hybrid**: one central discovery experience with dedicated specialist markets for each industry. The ten primary divisions are Sports; Entertainment & Media; Business & Corporate; Real Estate & Property; Technology & Intellectual Property; Professional Services & Talent; Industrial, Manufacturing & Trade; Agriculture & Natural Resources; Finance & Investment; and Institutions & Infrastructure.

Each division has its own categories, listing fields, participant permissions and industry-specific transaction workflows, while sharing discovery, counterparty communication, offers, negotiation, contract records and fulfilment infrastructure. The detailed approved taxonomy is in [docs/marketplace-taxonomy.md](docs/marketplace-taxonomy.md).

This is the approved product architecture, not a claim that every division's publishing, verification, contract or payment workflow is already implemented. The current persistent marketplace contract workflow remains limited to its released Services and B2B paths; specialist divisions must be connected and tested in stages.

## Metadusk ecosystem

TradeMate is one distinct product in the wider Metadusk ecosystem, alongside Deukleinz Technologies and PharmaCore. The founder's current intended structure and brand rules are documented in [docs/company-ecosystem.md](docs/company-ecosystem.md).

The ecosystem document records intended brand architecture and founder-reported information. It does not claim that Metadusk or every venture has been legally incorporated or that trademark registrations have been completed.

## Current product foundation

- Responsive Next.js web application and NestJS API.
- PostgreSQL-backed marketplace offer discovery, search, filters and business spaces.
- Authentication, secure sessions and account-security foundations.
- Services/B2B contract proposal and acceptance foundations.
- Enquiries, messaging, Feed posts, attachments and community features.
- Public market-information endpoints and related data integrations.

See [docs/architecture.md](docs/architecture.md) for architecture boundaries and [docs/roadmap.md](docs/roadmap.md) for implementation status, outstanding QA and later-stage work. Documentation distinguishes implemented foundations from planned work and production verification.

## Development and security

- Never commit environment files, credentials, API keys or secrets.
- Never collect wallet seed phrases or private keys.
- Enforce authorization and organization boundaries server-side.
- Keep payments, escrow, custody and P2P crypto features gated behind legal/compliance review, provider approval, threat modelling and security testing.
- Do not imply that any feature is available in every country or jurisdiction.

