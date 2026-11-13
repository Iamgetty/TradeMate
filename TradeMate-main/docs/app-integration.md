# TradeMate app integration

The supported web app is served by the Next.js route at **`/app`**. The Next.js App Router owns the document shell, route and same-origin API proxy. `TradeMateRuntime.tsx` mounts the existing legacy runtime in `apps/web/public/tm/app.js`; that file currently owns the feature UI, navigation, state and feature-level API client. The separate `feed-client.js` is an optional WebSocket data helper with no UI. Desktop and mobile-web presentation is supplied by `desktop.css` and `mobileweb.css` respectively.

See [frontend architecture and ownership boundaries](frontend-architecture.md) before adding or migrating frontend features. Avoid implementing duplicate screens, state or API clients across React and the legacy runtime.

The app calls the NestJS API through the same-origin `/api/*` proxy. Sessions use the existing HTTP-only cookie; browser JavaScript must not store session tokens.

## Connected features and API

| App feature | API |
|---|---|
| Sign up / sign in, session lookup, sign out | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| New-account email verification and resend | `POST /api/auth/email-verification/confirm`, `POST /api/auth/email-verification/resend` |
| Password reset | `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/complete` |
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

## Authentication lifecycle

- New registrations remain pending until the user confirms a six-digit, server-issued, one-time email verification code. Registration does not establish a session before confirmation.
- The code expires and is attempt-limited. Resend requests are handled server-side and use a generic response to reduce account enumeration.
- Login does not allow an unverified account to establish a session. Password reset is a separate one-time-token flow.
- Existing accounts grandfathered as verified remain subject to the normal account and session checks.
- TOTP verification remains server-backed; do not treat client-side code entry as authentication.

## Contract model

TradeMate's current marketplace is contract-first, not a conventional product checkout or buy/sell exchange.

1. A seller publishes a Services or B2B offer.
2. A buyer proposes the amount, scope, terms and optional dates.
3. A member of the seller's business space accepts or declines the proposal.
4. Either side can discuss the contract through its messages while it is open.
5. After acceptance, each side separately confirms fulfilment. The contract becomes completed only after both confirmations.

The current contract flow does not process payments, provide escrow, or constitute an electronic signature. Historical marketplace transaction records remain readable, but the conventional marketplace transaction creation/confirmation endpoints have been retired. P2P is a separate later-stage workstream and must not be mixed into this flow.

## Feed post requirements

The composer supports an optional title and requires a body. It accepts up to four attachments, each up to 5 MB, including images, PDFs and audio. Voice notes can be recorded in the composer, uploaded as audio attachments and played inline in the Feed. Attachment downloads/previews are served by the API. Mobile browser microphone permissions and media support still require device-level QA.

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
3. In `apps/web`: run `TRADEMATE_API_ORIGIN=http://localhost:4000 npm run dev` (the catch-all API proxy reads this server-side variable).
4. Open `http://localhost:3000/app`.
