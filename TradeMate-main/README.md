# TradeMate by Metadusk

**Trade Smart. Trade Direct.**

TradeMate is a global, contract-first business platform in the Metadusk technology ecosystem. It connects individuals and organizations to discover opportunities, communicate, negotiate terms, establish business agreements and manage contract fulfilment across supported markets.

TradeMate retains its independent product identity. **Metadusk Inc.** is the intended parent-company identity and ecosystem; the public product endorsement is **TradeMate by Metadusk**.

## Product direction

- One unified global marketplace with specialist industry divisions and shared contract-first deal-making infrastructure.
- A contract-centred workflow: counterparties discover one another, discuss an opportunity, negotiate scope and conditions, submit and review proposals, accept or decline terms, and confirm fulfilment.
- TradeMate is not a conventional product checkout or buy/sell exchange.
- TradeMate is not a cryptocurrency exchange or a spot/futures crypto trading platform. Crypto and Forex market information is distinct from the core contract workflow.
- Product listings and product-cart commerce are not part of the current product scope.
- P2P cryptocurrency offers and wallet-related capabilities are a separate later-stage workstream, not the definition of TradeMate.
- International use from day one, with country, currency, language and provider availability handled explicitly.

## Approved hybrid marketplace architecture

TradeMate's approved target is **one unified global marketplace organised into ten specialist divisions**. Users can discover opportunities across the marketplace or enter a division with its own categories, listing attributes, participant permissions, evidence requirements and industry-specific workflows.

1. **Sports** — athletes, coaches, recruitment, permitted transfers/loans, representation, sponsorships, teams and sports rights.
2. **Entertainment & Media** — artists, creators, representation, recordings, publishing, royalties, film, television, production, art and live events.
3. **Business & Corporate** — businesses for sale, acquisitions, mergers, franchises, joint ventures, distributors and strategic partnerships.
4. **Real Estate & Property** — residential/commercial property, land, industrial property, development, management, leases and concessions.
5. **Technology & Intellectual Property** — software, SaaS, platforms, AI, APIs, patents, trademarks, copyrights, licensing and commercialisation.
6. **Professional Services & Talent** — professional services, consultants, skilled specialists, recruitment, contractors and regulated professionals.
7. **Industrial, Manufacturing & Trade** — manufacturing, machinery, raw materials, wholesale, import/export, logistics, warehousing, distribution and procurement.
8. **Agriculture & Natural Resources** — farms, crops, livestock, fisheries, agricultural inputs, processing, mining, minerals, forestry and supply partnerships.
9. **Finance & Investment** — funding, venture capital, private equity, financing, trade finance, insurance and investment mandates, subject to regulation.
10. **Institutions & Infrastructure** — government/public procurement, energy, utilities, healthcare, education, research, transport, aviation, telecoms, construction and environmental/climate infrastructure.

**Division and transaction type are separate concepts.** A division describes the subject of an opportunity; a transaction type describes the intended arrangement. Depending on division policy and applicable law, transaction types may include sale/acquisition, transfer or loan, lease, recruitment, representation, licence, investment, partnership/joint venture, service contract, supply agreement, tender/RFP or concession/operating agreement. Not every transaction type is valid in every division.

The shared deal-making model is intended to cover discovery, verified counterparties, enquiries, offers and counteroffers, negotiation, private deal rooms, documents, contract review and acceptance, fulfilment, transaction records, reputation and dispute handling.

Important principles:
- TradeMate is contract-first and opportunity-led, not a conventional product-cart marketplace.
- People are not property. Sports and entertainment opportunities concern voluntary recruitment, representation, services and defined commercial rights; consent and applicable contract rules must be respected.
- Industry-specific rules matter. Public procurement, concessions and institutional contracts require authority, tender and compliance checks.
- Finance, investment, insurance, lending, healthcare, property, public procurement and payments require jurisdiction-specific legal, licensing and provider review.
- P2P crypto remains a separate workflow. Crypto and Forex market information does not make TradeMate a crypto or forex trading platform.

The detailed approved taxonomy, division-specific attributes, safeguards, shared capabilities and change-governance rules are documented in [docs/marketplace-taxonomy.md](docs/marketplace-taxonomy.md).

**Implementation boundary:** this is the approved target architecture, not a claim that all ten divisions or transaction workflows are implemented or production-ready. The currently established persistent marketplace contract paths remain Services and B2B. Specialist divisions must be connected and tested in stages. The implementation status and release sequence remain governed by [docs/roadmap.md](docs/roadmap.md).


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

