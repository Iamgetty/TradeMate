# TradeMate container images

These Dockerfiles are build artifacts only. They do not create AWS resources or deploy anything.

## Build from the repository root

```bash
docker build -f TradeMate-main/apps/api/Dockerfile -t trademate-api:local .
docker build -f TradeMate-main/exchange-feed/Dockerfile -t trademate-exchange-feed:local .
```

Both runtime images use the Node 22 Debian slim base and run as the unprivileged `node` user. The API image contains the compiled Nest application plus its migration runner and SQL migration files. The exchange-feed image runs the existing WebSocket service independently.

## API deployment and migrations

Run the API container with its runtime secrets supplied by the deployment platform. The API listens on `PORT` (default 4000) and reports container health through `GET /api/health`.

Database migrations are a separate release operation, not part of API startup:

```bash
docker run --rm --env-file /secure/path/trademate-migration.env trademate-api:local node scripts/migrate.js
```

The migration environment must provide `MIGRATION_DATABASE_URL` (or the currently supported transition fallback `DATABASE_URL`). Do not commit env files or pass database credentials on a command line. In ECS, run this as a one-off task using Secrets Manager injection, wait for exit code zero, and only then roll out the API service. Never run migrations concurrently from every API replica.

The migration runner already takes a PostgreSQL advisory transaction lock and tracks applied migration names. This does not replace a backup or restore rehearsal.

## Exchange feed

The exchange feed listens on `PORT` (default 3000) and exposes `GET /health`. Keep it as a separate ECS service from the API so WebSocket connection lifecycle, scaling and deployment draining can be tuned independently. Preserve the existing MT5 public-broadcast permission gates.

## Build-context and validation notes

- Build context is the repository root because the API Dockerfile copies its application directory and the exchange-feed Dockerfile uses its own package manifest.
- The API currently has no committed package lockfile; builds therefore use `npm install`, matching the existing CI workflow. Pinning and committing lockfiles is a separate dependency-management change.
- Local Compose currently uses PostgreSQL 16 while the migration target is PostgreSQL 18. Do not silently change the existing Compose volume's major version: upgrading an existing PostgreSQL data directory requires a deliberate dump/restore or `pg_upgrade` procedure. Validate fresh containers against PostgreSQL 18 in CI before changing local Compose defaults.
- These images have not yet been built or deployed in AWS. CI build validation is the next gate.
