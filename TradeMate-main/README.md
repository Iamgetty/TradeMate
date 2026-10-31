# TradeMate

**Trade Smart. Trade Direct.**

TradeMate connects people and organizations to explore opportunities, negotiate terms and enter into contracts across supported markets. It is designed for international use from day one—not as a single-country marketplace that expands later.

## Product direction

- Services, B2B opportunities, real estate, software, NFTs, Forex and crypto market information.
- TradeMate is not a conventional product checkout or buy/sell exchange. The core marketplace is about connecting counterparties and agreeing the terms of a business contract.
- Product listings and product-cart commerce are not part of the current product scope. A product marketplace may be reconsidered as a future roadmap option.
- Multi-currency and country-aware discovery, with availability determined by supported providers and applicable requirements.
- P2P cryptocurrency offers and related capabilities are a later-stage workstream, not a reason to change the current contract-first marketplace model.

## Implemented foundation

- Responsive Next.js web application and NestJS API.
- PostgreSQL-backed marketplace offer discovery, search, filters and seller/business spaces.
- Database migrations for marketplace data, accounts, authentication rate limits and community Feed attachments.
- Account registration and sign-in using scrypt password hashes, HTTP-only session cookies, revocable sessions and sign-in rate limiting.
- Account session lookup and sign-out.
- Business-space onboarding with country and default currency.
- Seller offer-draft creation, viewing, editing and moderation submission.
- Public market data endpoint for supported stock indices, commodities, equities and bonds/treasuries.
- Feed posts with titles, file/audio attachments and comments.
- Initial durable contract proposals for published Services/B2B offers, seller acceptance/decline, buyer cancellation and mutual fulfilment confirmation. This is not payment processing, escrow or e-signature.
- Health and database-health endpoints.

Offer drafts are private and are not public marketplace offers. A business space may remain pending. Do not treat these foundations as evidence that production readiness, all security testing, or end-to-end deployment verification is complete.

## Development sequence

1. **Pre-P2P marketplace completion:** finish the contract-first marketplace model, B2B publishing, Services, Feed, buyer/seller modes, Forex coverage, full-tab consistency and performance.
2. **Buyer–seller connection:** enquiries and messaging with access controls, abuse reporting and audit trails.
3. **Trust and operations:** counterparty reputation, disputes/support workflows, monitoring, automated tests, backups and recovery procedures.
4. **Contract lifecycle:** proposal, counterparty review, acceptance, fulfilment milestones and mutual completion confirmation. Payment processing is separate and must not be implied as available.
5. **P2P:** begin only after the pre-P2P requirements and additional product instructions are complete; require jurisdiction-specific legal/compliance review, provider approval, threat modelling and independent security testing before any live trading, escrow, custody or crypto-payment launch.

The current technical roadmap is in [docs/roadmap.md](docs/roadmap.md).

## Security and global-product rules

- Never commit `.env` files, API keys, credentials or secrets.
- Never collect wallet seed phrases or private keys.
- Enforce authorization and organization boundaries on the server for every private operation.
- Store monetary amounts as integer minor units with an explicit ISO currency code; never assume every user uses NGN.
- Store timestamps in UTC and format them for the user's locale and time zone.
- Keep country, language, currency, tax, shipping and payment availability as separate configurable concepts.
- Do not imply that every payment method, service or crypto feature is available in every jurisdiction.

See [docs/architecture.md](docs/architecture.md) for architecture and security boundaries.
