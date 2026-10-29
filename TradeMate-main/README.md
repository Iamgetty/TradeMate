# TradeMate

**Trade Smart. Trade Direct.**

TradeMate is a global-first marketplace connecting buyers, sellers, service providers, and people trading across supported markets. It is designed for international use from day one—not as a single-country marketplace that expands later.

## Product direction

- A global marketplace for products and services.
- Direct buyer–seller connections, supported by trust, moderation, and reputation features.
- Multi-currency and country-aware discovery, with availability determined by supported providers and applicable requirements.
- Planned P2P cryptocurrency offers, wallet connectivity, and eligible crypto payments. These are later-stage capabilities, not currently live.

## Implemented foundation

- Responsive Next.js web application and NestJS API.
- PostgreSQL-backed public marketplace listing discovery, search, and filters.
- Database migrations for marketplace data, accounts, and authentication rate limits.
- Account registration and sign-in using scrypt password hashes, HTTP-only session cookies, revocable sessions, and sign-in rate limiting.
- Account session lookup and sign-out.
- Business-space onboarding with country and default currency.
- Seller offer-draft creation, viewing, editing, and deletion.
- Health and database-health endpoints.
- Deployment configuration for the web and API services.

Offer drafts are private and are not public marketplace listings. A business space may remain pending. Do not treat these foundations as evidence that production readiness, all security testing, or end-to-end deployment verification is complete.

## Development sequence

1. **Marketplace core:** finish seller offer lifecycle, validation, ownership checks, review/moderation, and safe publishing.
2. **Buyer–seller connection:** enquiries and messaging with access controls, abuse reporting, and audit trails.
3. **Trust and operations:** seller reputation, disputes/support workflows, monitoring, automated tests, backups, and recovery procedures.
4. **Transactions:** define orders and payment-provider integration with explicit transaction states and reconciliation.
5. **Wallet and P2P:** design and implement only after the marketplace core is stable; require jurisdiction-specific legal/compliance review, provider approval, threat modelling, and independent security testing before any live trading, escrow, custody, or crypto-payment launch.

Visual redesign is intentionally paused while functional integration proceeds. Avoid unnecessary changes to the design system until the product modules are integrated and ready for a coordinated design pass.

## Security and global-product rules

- Never commit `.env` files, API keys, credentials, or secrets.
- Never collect wallet seed phrases or private keys.
- Enforce authorization and organization boundaries on the server for every private operation.
- Store monetary amounts as integer minor units with an explicit ISO currency code; never assume every user uses NGN.
- Store timestamps in UTC and format them for the user's locale and time zone.
- Keep country, language, currency, tax, shipping, and payment availability as separate configurable concepts.
- Do not imply that every payment method, product, service, or crypto feature is available in every jurisdiction.

See [docs/architecture.md](docs/architecture.md) for architecture and security boundaries.
