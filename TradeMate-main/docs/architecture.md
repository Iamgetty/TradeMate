# TradeMate architecture and security boundaries

## Product identity
- Public product name: TradeMate.
- Tagline: “Trade Smart. Trade Direct.”
- Product principle: global from inception. TradeMate is not a Nigeria-first product.
- Do not display “by Nexora” or “by Deu Kleinz Technologies” in public product branding.

## Global product strategy
Build for international use from day one. No single country, currency, language, or user context should be assumed as the default.
- Store monetary amounts as integer minor units alongside an explicit ISO currency code; never assume all prices are NGN.
- Store timestamps in UTC and format them for each user's locale and time zone.
- Keep country, language, currency, tax, shipping, and payment availability as separate configurable concepts.
- Use country-aware validation for phone numbers and addresses.
- Allow discovery across markets by default; apply country filters only when users choose them.
- Do not imply every payment method, service, product, or crypto feature is available in every jurisdiction. Availability depends on provider support and applicable requirements.

## Product modules
- Market: product listings, discovery, seller pages, favourites, reporting.
- Services: provider pages, enquiries, quotes, booking requests.
- Connect: messaging, ratings, reputation.
- Admin: moderation, support, disputes, audit views.
- P2P and Wallet: planned capabilities for peer-to-peer cryptocurrency offers, wallet connections, and eligible crypto payments. These are not implemented in the current foundation.

## Data foundation
Use PostgreSQL for persistent marketplace data, with version-controlled schema migrations and backups. Introduce users and organizations, seller storefronts, listings and media, categories, enquiries/orders, moderation reports, and audit events incrementally. Enforce authorization and organization boundaries server-side.

Do not store real customer information until authentication, access controls, validation, and operational safeguards are in place.

## Current implementation boundary
The current foundation includes a responsive web experience, an API health endpoint, and public marketplace listing discovery backed by PostgreSQL. Authentication, seller listing creation, messaging, payment processing, escrow, crypto trading/custody, wallet connection, and mobile apps are not yet implemented.

## Security principles
- Never commit `.env` files, API keys, or secrets.
- Never collect wallet seed phrases or private keys.
- Use least privilege, server-side validation, rate limits, secure sessions, audit trails, and dependency updates when implementing user features.
- Treat payment, P2P crypto, escrow, and custody as gated projects requiring jurisdiction-specific legal/compliance review, provider approval, threat modelling, and security testing.
- Before production, add database migrations, backups, monitoring, error reporting, tests, and a rollback procedure.
