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
- Do not imply every payment method, service, B2B opportunity or crypto feature is available in every jurisdiction. Availability depends on provider support and applicable requirements.

## Product modules
- Market: Services and B2B opportunities, discovery, counterparty pages, favourites and reporting.
- Contracts: contract proposals, counterparty review, acceptance, fulfilment and mutual completion confirmation.
- Connect: enquiries, messaging, ratings and reputation.
- Admin: moderation, support, disputes and audit views.
- P2P and Wallet: later-stage capabilities for peer-to-peer cryptocurrency offers, wallet connections and eligible crypto payments. Do not start this workstream until the pre-P2P roadmap and additional product instructions are complete.

## Data foundation
Use PostgreSQL for persistent marketplace data, with version-controlled schema migrations and backups. Introduce users and organizations, counterparty profiles, Services and B2B offers, contract proposals and messages, moderation reports and audit events incrementally. Enforce authorization and organization boundaries server-side.

Do not store real customer information until authentication, access controls, validation, and operational safeguards are in place.

## Current implementation boundary
The repository currently includes a responsive Next.js web app, NestJS API, PostgreSQL-backed authentication and business-space/offer foundations, enquiries and messaging, Feed posts with attachments, and public market quote endpoints. The repository now includes an initial durable contract proposal/acceptance/dual-fulfilment-confirmation API and Buyer/Seller Contracts views. This foundation still requires end-to-end security and workflow QA, and does not process payments, provide escrow or constitute an e-signature. Crypto custody and wallet connection are not established as production capabilities. P2P foundations are present in the codebase but remain outside the current pre-P2P workstream.

## Security principles
- Never commit `.env` files, API keys, or secrets.
- Never collect wallet seed phrases or private keys.
- Use least privilege, server-side validation, rate limits, secure sessions, audit trails, and dependency updates when implementing user features.
- Treat payment, P2P crypto, escrow, and custody as gated projects requiring jurisdiction-specific legal/compliance review, provider approval, threat modelling, and security testing.
- Before production, add database migrations, backups, monitoring, error reporting, tests, and a rollback procedure.
