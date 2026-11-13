# TradeMate — local setup and deployment notes

## Current application overview

TradeMate is an actively developed marketplace platform, not a landing-page-only starter. The repository currently contains three separately runnable application services:

- **Web application:** Next.js and React provide the web application shell and routes. Some established application experiences still run through a legacy JavaScript runtime loaded by the Next.js app. Keep the boundaries clear and check for existing functionality before adding parallel implementations.
- **API:** a NestJS/TypeScript API provides authentication and account workflows, marketplace/listing and organization operations, contracts, Feed, moderation and other application endpoints. PostgreSQL stores persistent application data; schema changes are managed through versioned migrations.
- **Exchange feed:** a separate Node.js service provides exchange/market-feed connectivity used by the application. Feed availability and freshness depend on its runtime and upstream providers.

The codebase includes server-backed account registration and email verification, login/session security, password reset, TOTP support, marketplace and contract workflows, and other features at varying levels of completion. A feature being present in source does not mean its provider configuration, production deployment or end-to-end acceptance is complete. Consult [the project roadmap](docs/roadmap.md) for implementation status and outstanding gates.

## Prerequisites

- Node.js 20 or later for the web and API development workflows.
- npm.
- Docker with Docker Compose, for the optional local PostgreSQL/Redis services.
- Access to a PostgreSQL database for API workflows and migration tests.

## Local database services

From the repository root, start the local supporting services:

~~~sh
docker compose -f infra/docker-compose.yml up -d
~~~

The compose file provisions PostgreSQL on port 5432 and Redis on port 6379. Its database password is for local development only. Never reuse it in staging or production.

Configure the API's local environment with the appropriate PostgreSQL connection string (normally DATABASE_URL), a local web origin and any other required startup settings validated by the API. Use a local-only environment file that is ignored by Git; never commit real credentials, tokens or secret values. If testing email delivery, configure the Resend settings with a dedicated test/development sender and key. Do not point local migration commands at a production database.

## Run the API

In a terminal:

~~~sh
cd apps/api
npm install
npm run start:dev
~~~

The API listens on port 4000 by default and exposes its health endpoint at /api/health. Build and run the API checks with:

~~~sh
npm run build
npm run test:security
~~~

Database migrations are registered in the API migration runner. Review the pending migration files and confirm the target database before running npm run db:migrate. Use only a disposable/local or explicitly designated test database for local development and integration tests.

## Run the web application

In a second terminal:

~~~sh
cd apps/web
npm install
npm run dev
~~~

Open http://localhost:3000/app. Configure the API origin using the environment variable expected by the current web runtime (for local API development, the API origin is normally http://localhost:4000). Check the existing runtime configuration before changing proxy paths or introducing a second API client.

Build the web application with:

~~~sh
npm run build
~~~

The web package also provides npm run test:e2e for its Playwright browser suite when the browser-test dependencies are installed.

## Run the exchange-feed service

In another terminal:

~~~sh
cd exchange-feed
npm install
npm start
~~~

Run its tests with:

~~~sh
npm test
~~~

The feed service has its own health endpoint at /health. Verify the configured feed URL and upstream provider availability before expecting live quotes; do not treat cached or stale snapshots as live prices.

## Render deployment topology

The root render.yaml Blueprint defines three services:

1. trademate-api — NestJS API, with a health check at /api/health.
2. trademate-web — Next.js web application.
3. exchange-feed — separate market-data feed service, with a health check at /health.

The Blueprint is configuration, not proof that each service is deployed, healthy or connected. Verify each service's deployed commit, deployment result, health endpoint, required environment-variable presence, logs and service-to-service connectivity in the Render dashboard. Confirm the web/API origin and exchange-feed integration against the intended environment. Never point a production frontend at a staging API or database.

The API Blueprint includes separate environment slots for migration and worker database credentials. Keep migration privileges separate from the API runtime credential. Do not paste secret values into source files, logs, pull requests or chat. Do not run production migrations, change production environment variables or deploy without explicit approval.

## Development and release discipline

- Run the relevant API, web, feed, database integration, browser and security tests for the code being changed.
- Review the complete diff and current roadmap before changing shared runtime, authentication, database or deployment configuration.
- Preserve the established Next.js/legacy-runtime boundary; search for existing screens, handlers and state before adding new functionality.
- Make backend modularization incremental and compatibility-preserving; do not change endpoint contracts or authorization rules as a side effect of moving code.
- Treat migrations as separately reviewed database changes. Clean-database CI success does not authorize a live migration.
- A successful CI run does not prove a Render deployment is live. Verify all three services and their connections independently.
- Do not launch payment, escrow, custody or crypto/P2P financial features until the roadmap's legal, compliance, provider, threat-modelling and independent security gates are satisfied.

For the authoritative product direction, security phases, current completion register and future work, see [docs/roadmap.md](docs/roadmap.md).
