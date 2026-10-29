# TradeMate app integration

The mobile-style TradeMate app (`apps/web/public/tm/app.js`) is served by the Next.js web service at **`/app`** and talks to the NestJS API through the existing same-origin proxy (`/api/*`). Sessions use the existing HTTP-only cookie, so no tokens are stored in the browser.

## What is connected

| App feature | API |
|---|---|
| Sign up / sign in (email + password) | `POST /api/auth/register`, `POST /api/auth/login` |
| Stay signed in, sign out | `GET /api/auth/me`, `POST /api/auth/logout` |
| Markets (Products, Services) | `GET /api/market/listings` |
| Business space | `GET/POST /api/organizations` |
| Create order (Products, Services) | `POST /api/market/listings`, then `POST /api/market/listings/:id/submit` |
| My offers, submit, delete draft | `GET /api/market/listings/mine`, `POST .../submit`, `DELETE .../:id` |
| Chat, Buy now, Place bid, Order now | `POST /api/market/enquiries`, `GET/POST /api/market/enquiries/:id/messages`, `GET /api/market/enquiries/mine` |

Buy, bid and order requests are sent as the first message of an enquiry, because the API has no orders or payments yet.

## Not connected yet (the app says so)

Real estate, software, businesses and NFT listings (the database only allows `product` and `service`), P2P adverts and orders, wallet and deposits, identity verification, support tickets and feedback, rewards, mobile-number sign-in and password reset. These stay local to the device or show an honest "not available yet" message.

## Rules the app follows

- Passwords need 12+ characters (API rule). Mobile-number sign-in is refused with a clear message.
- Offers use the business space's country and currency. If the user picks another currency in the wizard, the app blocks it and explains.
- New business spaces and offers stay hidden until reviewed with `/api/moderation/*` and `TRADEMATE_REVIEW_API_KEY`.
- Crypto and forex prices come from public APIs (CoinGecko, open.er-api.com) and are labelled as reference only.

## Run locally

1. `docker compose -f infra/docker-compose.yml up -d`
2. `apps/api`: copy `.env.example` to `.env`, `npm install`, `npm run db:migrate`, `npm run start:dev`
3. `apps/web`: `NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev`
4. Open `http://localhost:3000/app`
