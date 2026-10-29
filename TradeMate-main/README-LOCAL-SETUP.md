# TradeMate — local setup and deployment notes

## Current status
This is an initial foundation, not a production-ready marketplace. The web app is a landing page; the API currently exposes only `GET /api/health`. Product listings, accounts, messaging, payment flows, and database-backed features are not implemented.

## Web app
1. Install Node.js 20 or later.
2. Open a terminal in `apps/web`.
3. Run `npm install`.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Run `npm run build` before deployment.

## API
1. Open a separate terminal in `apps/api`.
2. Run `npm install`.
3. Run `npm run start:dev`.
4. Check `http://localhost:4000/api/health`.
5. Run `npm run build` before deployment.

## Local PostgreSQL and Redis
From the repository root, run `docker compose -f infra/docker-compose.yml up -d`. The password in the compose file is for local development only; replace it for any shared environment.

## Render deployment
The `render.yaml` file is a starter Blueprint, not proof of a successful deployment. Review the build/start commands and environment variables in Render before creating services. Configure `NEXT_PUBLIC_API_URL` to the deployed API base URL (without a trailing slash). Configure `WEB_ORIGIN` to the deployed website origin. Never paste credentials into source files or commit real `.env` files.

## Before production
Add and test authentication, authorization, persistent data models and migrations, input validation, rate limiting, security headers, logging, monitoring, backups, and rollback procedures. Do not launch payments, escrow, or crypto/P2P features until legal, compliance, provider, and security reviews are complete.
