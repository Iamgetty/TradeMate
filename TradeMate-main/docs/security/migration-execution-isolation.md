# ADR: Isolated database migration execution

- **Status:** Proposed; implementation and platform configuration not approved
- **Date:** 2026-11-19
- **Scope:** Production database schema changes and API deployment ordering

## Context

The production Render Blueprint currently configures `MIGRATION_DATABASE_URL` on the `trademate-api` web service and starts it with:

```sh
npm run db:migrate && npm run start:prod
```

The migration runner correctly refuses to fall back to `DATABASE_URL` when `NODE_ENV=production`. However, both commands execute in the same service environment, so the long-running API process inherits the elevated migration credential.

A second path exists in `.github/workflows/database-migrations.yml`. It can run on migration-related pushes to `main` as well as manually, and its secret check accepts either `TRADEMATE_MIGRATION_DATABASE_URL` or the ordinary `TRADEMATE_DATABASE_URL`. The workflow does not currently establish a reviewed production-environment approval gate or prove that GitHub-hosted runners have safe, stable network access to the production database. It must not be treated as an approved production migration path.

Render documents that pre-deploy commands execute on a separate instance from the running service, but they use the service's configured environment. Moving the command to `preDeployCommand` alone therefore does not remove the migration credential from the API service configuration. In addition, the current `trademate-api` Blueprint plan is `free`, while Render documents pre-deploy commands as available only for paid web services, private services and background workers; this is not an immediately available option without a plan change. Render one-off jobs inherit the environment of their base service, so they also require a dedicated migration-only base service rather than the API service.

## Security and release requirements

1. The API runtime receives only its least-privilege `DATABASE_URL`; it must not receive, inherit or be able to read the migration credential.
2. Only a separately controlled migration execution identity receives `MIGRATION_DATABASE_URL`.
3. The migration execution path must be explicit, auditable, concurrency-serialized and protected by an approval gate appropriate to the target environment.
4. A release must not start the new API version until the required migration job has succeeded against the intended database and release revision.
5. Migration execution must use the immutable artifact/revision being released, not an unpinned branch head or stale build.
6. Existing migration manifest validation and PostgreSQL advisory transaction lock remain mandatory. The lock prevents concurrent migration transactions; it does not replace release orchestration.
7. Failure must stop promotion. Define forward-fix and rollback compatibility for expand/contract migrations; do not assume arbitrary schema rollback is safe.
8. Logs and status must identify release SHA, migration set, target environment, start/end time and outcome without printing connection strings, credentials or sensitive row data.
9. CI must prove that the API process environment does not contain the migration secret and that migration execution fails closed when the dedicated credential is absent. Tests must use disposable local databases only.
10. No production credential rotation, environment-variable change, migration, service creation, deployment or database modification is authorized by this ADR.

## Options to evaluate

### A. Dedicated Render migration-only service plus one-off job

Use a separate Render service as the one-off job base, configured with the same immutable application build and only the migration credential (plus non-secret runtime settings required by the migration runner). The API service has only the runtime credential. The job is manually or orchestrator-triggered, and API promotion is gated on its successful completion.

Render one-off jobs inherit the base service's build artifact and configured environment. Using the API service as the base is unacceptable because it would re-expose all API environment variables to the migration job; a dedicated migration-only base is required. Evaluate service type, cost, private database connectivity, artifact pinning, job trigger permissions, approval, status polling and failure handling before selecting this option.

### B. Protected GitHub Actions migration environment

Use an explicitly approved GitHub Environment with a migration-only secret and required reviewers; remove the ordinary runtime-credential fallback and automatic production migration trigger. This option is acceptable only if production database connectivity from the runner is verified without broadening inbound database access unsafely, and if the workflow serializes migration and release promotion for the exact artifact. GitHub-hosted runner IP ranges or broad public database allowlists are not an acceptable default.

### C. Render pre-deploy command

This can provide migration-before-deploy ordering on supported paid services, but is not sufficient by itself for credential isolation while the migration credential remains configured on the API service. Do not select this option without a platform-supported mechanism that gives the pre-deploy process a migration-only environment and withholds that credential from the API process.

## Decision gates

Before implementation, record a reviewed decision covering:

- Render service topology and supported service/job semantics.
- Database network path and TLS verification.
- Environment-scoped secret ownership and least-privilege access.
- Exact release artifact and migration/API deployment ordering.
- Approval, concurrency, timeout, retry and failure behavior.
- Backward-compatible migration strategy and rollback/forward-fix runbook.
- CI tests for missing/wrong credentials, environment isolation, manifest mismatch, lock contention and failed migration handling.
- Staging rehearsal, observability and accountable owner sign-off.

## Current disposition

No option is selected. The current Render startup path and GitHub workflow are both tracked as gaps; neither is certified as a secure production migration architecture. Keep the runtime/migration credential-isolation item partial and do not claim production acceptance.


## Implementation review — 19 November 2026

A fresh source review of the branch confirms that the isolation problem is not limited to Render configuration:

- `TradeMate-main/apps/api/src/main.ts` calls `validateEnvironment()` before NestJS bootstrap.
- `TradeMate-main/apps/api/src/environment.ts` currently requires both `DATABASE_URL` and `MIGRATION_DATABASE_URL` whenever `NODE_ENV=production`. The API therefore has an explicit runtime dependency on the migration secret in addition to inheriting it from the Render service environment.
- `TradeMate-main/apps/api/scripts/migrate.js` correctly fails closed in production when `MIGRATION_DATABASE_URL` is absent and does not fall back to `DATABASE_URL`. Preserve this property.
- `TradeMate-main/render.yaml` still places both credentials on `trademate-api` and invokes the migration command in that service's startup sequence.
- `.github/workflows/database-migrations.yml` still has a push trigger and accepts the ordinary runtime credential as a fallback. It does not declare a protected GitHub Environment.
- The API package has no dedicated environment-validation test file in the reviewed paths; the CI migration tests intentionally use the runtime URL for disposable local PostgreSQL, which is valid in non-production mode.

### Decision: no production migration path is approved yet

Do not make a partial code-only change that merely stops API validation from requiring `MIGRATION_DATABASE_URL`: the secret would remain readable through `process.env` because Render still injects it into the same service. Likewise, do not move the command to Render pre-deploy or use an API-based one-off job and describe that as isolation; the platform environment inheritance described above remains material.

The next implementation must first establish a separately credentialed migration execution boundary and a release orchestrator that can prove the migration job and API deployment use the same immutable revision. The platform owner must verify database connectivity, protected approval configuration, secret ownership and service/job semantics before the implementation option is selected. If those prerequisites cannot be demonstrated, keep migration automation disabled for production rather than weakening network access or silently falling back to a lower-privilege credential.

### Required implementation sequence

1. Obtain and record platform-owner confirmation of the migration-only execution service/job or other supported isolated runner, including its exact environment-variable set and database network path.
2. Remove `MIGRATION_DATABASE_URL` from the API service environment only as part of the same coordinated change that provides the separately credentialed migration runner and release gate; do not strand deployments without a migration path.
3. Make production API environment validation require only runtime credentials. Keep migration credential validation inside the migration entry point, with explicit production fail-closed behavior and no runtime-role fallback.
4. Replace the current push-triggered/fallback GitHub workflow only after protected environment reviewers, migration-only secret scope, runner-to-database connectivity, immutable SHA/artifact pinning, concurrency, and API promotion ordering are verified. A YAML environment name alone is not proof that reviewer protection is configured.
5. Add regression tests proving the API bootstrap succeeds without the migration secret, migration execution fails closed without it in production, the API process cannot read it, and the migration runner cannot silently use the runtime role. Add orchestration tests for exact-SHA matching, serialized runs, and failure blocking promotion.
6. Rehearse the full sequence against a disposable/staging database, capture logs without credentials, verify forward-fix/rollback compatibility, and obtain accountable approval before any production change.

No code, production configuration, secret, database, migration or deployment was changed during this review. The status remains proposed/partial, not implemented or production accepted.
