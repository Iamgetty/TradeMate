# TradeMate app integration

The mobile-style TradeMate app (`apps/web/public/tm/app.js`) is served by the Next.js route at **`/app`** through `TradeMateRuntime.tsx`. It calls the NestJS API through the same-origin `/api/*` proxy. Sessions use the existing HTTP-only cookie; browser JavaScript does not store session tokens.

## Connected features and API

| App feature | API |
|---|---|
| Sign up / sign in, session lookup, sign out | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| Services and B2B offer discovery | `GET /api/market/listings` |
| Business spaces | `GET/POST /api/organizations` |
| Create, view, edit and submit an offer draft | `POST /api/market/listings`, `GET /api/market/listings/mine`, `POST /api/market/listings/:id/submit`, `DELETE /api/market/listings/:id` |
| Contract list and detail | `GET /api/market/contracts/mine`, `GET /api/market/contracts/:id` |
| Propose a contract against a published Services/B2B offer | `POST /api/market/contracts` |
| Seller accept or decline; buyer cancel | `PATCH /api/market/contracts/:id/respond`, `PATCH /api/market/contracts/:id/cancel` |
| Mutual fulfilment confirmation | `PATCH /api/market/contracts/:id/confirm-completion` |
| Contract messages | `GET/POST /api/market/contracts/:id/messages` |
| Pre-contract enquiries and conversations | `POST /api/market/enquiries`, `GET /api/market/enquiries/mine`, `GET/POST /api/market/enquiries/:id/messages` |
| Public Forex reference quotes | `GET /api/market/quotes` |
| Feed posts, titles and attachments | `GET/POST /api/feed/posts`, `GET /api/feed/posts/:id/attachments/:attachmentId` |
| Feed comments and reports | `GET/POST /api/feed/posts/:id/comments`, `POST /api/feed/reports` |
| Health | `GET /api/health`, `GET /api/health/db` |

## Contract model

TradeMate's current marketplace is contract-first, not a conventional product checkout or buy/sell exchange.

1. A seller publishes a Services or B2B offer.
2. A buyer proposes the amount, scope, terms and optional dates.
3. A member of the seller's business space accepts or declines the proposal.
4. Either side can discuss the contract through its messages while it is open.
5. After acceptance, each side separately confirms fulfilment. The contract becomes completed only after both confirmations.

The current contract flow does not process payments, provide escrow, or constitute an electronic signature. Historical marketplace transaction records remain readable, but the conventional marketplace transaction creation/confirmation endpoints have been retired. P2P is a separate later-stage workstream and must not be mixed into this flow.

## Feed post requirements

The composer requires a title and body. It accepts up to four attachments, each up to 5 MB, including images, PDFs and audio. Voice notes can be recorded in the composer, uploaded as audio attachments and played inline in the Feed. Attachment downloads/previews are served by the API. Mobile browser microphone permissions and media support still require device-level QA.

## Forex reference data

The Forex market groups include ten stock indices, ten commodities, ten individual equities and ten bonds/treasuries. The quote route uses a public Yahoo Finance data source with a server-side symbol allowlist and cache; it does not require OANDA account credentials or private OANDA API tokens. Quotes are reference data, not TradeMate buy/sell executions.

## Scope and verification limits

- The persistent listing model currently accepts Services and B2B offer types. Product listings and cart checkout are not part of the current app. A Product marketplace is only a future consideration and must not silently reappear.
- Real Estate, Software and NFT market surfaces are not yet connected to the same durable Services/B2B contract workflow.
- P2P-related code and routes exist, but the P2P roadmap stage remains gated on completion of the pre-P2P audit and the product owner's remaining instructions.
- Contract and Feed code paths have build/migration coverage; live end-to-end testing, mobile-device testing, production authorization review and deployment verification remain outstanding.
- No payment processing, escrow, custody or wallet connection should be implied as available.

## Rules the app follows

- Passwords are stored as scrypt hashes; sessions use HTTP-only cookies, revocation and sign-in rate limiting.
- Offer drafts are private and do not become public until submitted and approved.
- Server-side authorization enforces buyer and seller-organization access to contract records and messages.
- Monetary values are stored as integer minor units with an explicit currency code.
- Timestamps are stored in UTC and formatted for the user's locale and time zone.
- Availability of payment methods, services and crypto features depends on provider support and applicable requirements.

## Run locally

1. `docker compose -f infra/docker-compose.yml up -d`
2. In `apps/api`: copy `.env.example` to `.env`, run `npm install`, `npm run db:migrate`, then `npm run start:dev`.
3. In `apps/web`: run `NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev`.
4. Open `http://localhost:3000/app`.
