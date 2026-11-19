# TradeMate Audit Remediation Checklist

Baseline reviewed: `main` at `02d27f0313ca817b030c7fe2d2b8b5f5b9a692c1` (2026-11-18).

This checklist records the source/configuration audit findings. Items are not complete until the relevant code change, automated checks, and required runtime verification have passed. Do not merge or deploy without explicit approval.

## 1. Database migrations and profile integrity — code fix validated in CI

- [x] Update `apps/api/scripts/migrate.js` so migrations `024_usernames.sql` and `025_ensure_public_profile_rows.sql` are included and applied in the correct order.
- [x] Update `updateMyProfile()` in `apps/api/src/module.ts` so every profile-row insert satisfies the username NOT NULL constraint and username uniqueness rules.
- [x] Update the `test-rls-pilot.js` fixture to provide a valid username after migration 024.
- [x] Add a regression test that compares migration files with the runner's applied migration list, so future migrations cannot silently be skipped (runner fails fast on manifest mismatch).
- [x] Run clean-database migration integration tests and profile create/update tests (CI run `44425744634`, all 8 jobs passed, including the full database integration and browser acceptance jobs).
- [x] Review PR #216 against this branch's fix: it overlaps the migration registration and profile username insert, but omits the manifest guard and RLS fixture update. PR #219 contains the superset; leave #216 open and unmerged pending explicit PR housekeeping approval.

## 2. Database backup and restore verification — urgent operational item

- [ ] Complete a restore of the existing custom-format backup into the local disposable database `trademate_restore_test`.
- [ ] Verify restore exit status, expected schema/tables, representative row counts, and application-level connectivity.
- [ ] Record backup file size, archive validation result, restore result, and verification evidence without putting database URLs or passwords in chat or repository files.
- [ ] Confirm a recoverable backup before the Render database expiry on 2026-11-25.
- [ ] After backup/access needs are resolved, replace the broad database IP allowlist `0.0.0.0/0` with the narrowest practical allowlist.

## 3. Render deployment and health configuration

- [ ] Reconcile actual Render `autoDeployTrigger: commit` settings with `render.yaml` `checksPass` policy.
- [x] Read-only live audit (2026-11-19): web and API use `commit`; exchange-feed uses `checksPass`. Web has no health-check path; API uses `/api/health`; feed uses `/health`. No live settings were changed.
- [x] Record live deployment SHAs: web `02d27f0313ca817b030c7fe2d2b8b5f5b9a692c1`, API `d743ab1bc782676e6e35af6a3c234f94bbc6cf19`, exchange-feed `a3733604e58182d02b1891f595a5f75d399a2e3e`. These differ because the services have separate deployment histories; confirm compatibility before aligning them.
- [ ] Review whether web health checks should use a lightweight web liveness endpoint; do not point web at the API health endpoint without confirming service boundaries.
- [x] Verify API health route mapping: Nest applies the `/api` global prefix, so Render's `/api/health` maps to the liveness-only `HealthController.health()` route. `/api/health/database` separately performs `SELECT 1`; it is database readiness/diagnostics, not the configured liveness check.
- [ ] Decide whether API deployment readiness should depend on database connectivity; assess startup/migration behavior and outage policy before changing health checks.
- [x] Close the production migration-role fallback: source audit found the migration runner could fall back to the runtime `DATABASE_URL`, while production validation did not require `MIGRATION_DATABASE_URL`. The runner now requires the dedicated migration URL in production; API environment validation also requires it, and a regression test verifies production refuses the fallback. Validated by CI run `44427485813`: API build/security, database integration, browser acceptance (39 E2E tests), security scanning, Cloudflare Workers, web, exchange-feed/MT5, and container builds all passed.
- [ ] Add a lightweight web-service liveness endpoint only if the web runtime/platform requires one; no dedicated web health endpoint was found in the inspected app routes.
- [x] Update the Render Blueprint to declare `DATABASE_URL` for the API runtime separately from `MIGRATION_DATABASE_URL` for migrations; both remain `sync: false`, and no secret values are stored in the repository.
- [ ] Verify the live API service has both variables configured and that they point to the intended roles/database, without exposing secret values. The Render service-details response does not expose environment-variable names, so presence/role assignment remains unverified; do not infer it from Blueprint declarations.
- [ ] Measure web/API-to-exchange-feed cross-region latency and decide whether region alignment is warranted.
- [ ] Verify deployment commit SHAs and check results before treating a service as current or healthy.

## 4. Homepage animation and frontend behavior

- [x] Remove the unwanted legacy `.view.enter > *` entrance animation and its redundant override. The shared `@keyframes in` remains because other non-homepage screens (`.pgw`, `.lg`, and `#out`) still use it.
- [x] Preserve the existing boot-gate loader in `app/layout.tsx`; the homepage entrance selector is removed. Runtime refresh/navigation verification remains open.
- [x] Remove the remaining `.view.enter .mk-card` animation: those `.mk-card` elements are the Home marketplace shortcut tiles. Keep `.view.enter` animations scoped to market-page components that do not form the Home shortcuts.
- [x] Add and pass a browser regression test that checks the served app bundle on initial load and refresh for both the broad legacy selector and the Home shortcut selector (CI run `44412507433`, browser acceptance job passed).
- [ ] Verify refresh, direct navigation, back/forward navigation, mobile layout, and reduced-motion behavior.
- [ ] Regression-test homepage carousel and Explore category interactions; distinguish the active homepage carousel from the currently unloaded `category-ads.js`.

## 5. Frontend/backend feature verification

- [x] Create the initial source-level feature-to-endpoint acceptance matrix at `TradeMate-main/docs/feature-endpoint-acceptance-matrix-2026-11-19.md`; detailed workflow tests and provider/runtime acceptance remain open.
- [ ] Test each claimed server-backed workflow against the real API contract and persisted state.
- [x] Verify the new NFT provider timeout/resilience tests in CI; all five route-level tests passed in CI run `44425744634` browser acceptance job (39 E2E tests passed total). `/api/nfts` and `/api/nft-collections` apply 8-second abort timeouts to all OpenSea requests.
- [ ] Clearly label or disable incomplete flows until their backend/provider and security controls exist: KYC submission, crypto/fiat deposits, transfers/withdrawals, wallet funding, B2B subaccounts, social OAuth linking, referral rewards, promotion participation, advertising request submission, TradeMate Card, and unconfigured fee rates.
- [ ] Ensure sample Portfolio Manager values and synthetic Contract Scout sparklines are not presented as real user balances or suitability recommendations.
- [ ] Test on representative desktop and mobile viewports; record failures with reproducible steps.

## 6. Production database security

- [ ] Establish production least-privilege database roles and verify the application uses the intended role.
- [ ] Plan and validate production RLS enablement and policies against real application workflows before rollout.
- [ ] Run cross-account isolation tests against the production-equivalent schema and roles.
- [ ] Complete DAST/independent penetration testing and resolve relevant dependency/security advisories.
- [ ] Confirm branch protection and review requirements for protected branches.

## 7. Pull-request and branch reconciliation

- [ ] Reconcile PR #216 with section 1 before considering merge.
- [ ] Reconcile Sports Transfer PR #213 with stacked PRs #171, #172, and #173; do not merge the chain blindly.
- [ ] Reassess PRs #176, #147, #146, #142, #134, #131, #130 against current `main`; identify superseded or conflicting work.
- [ ] Keep already-merged PRs #209, #214, #215, and #218 closed/merged; do not recreate their changes unnecessarily.
- [ ] Confirm each remaining PR's base, head, changed files, conflicts, and current CI status before action.

## 8. AWS/Cloudflare migration readiness — no cutover yet

- [ ] Resolve documentation disagreement about Render as current production versus AWS as target.
- [ ] Verify Cloudflare Workers adapter compatibility, including the API proxy route currently declaring `runtime = 'nodejs'`.
- [ ] Validate AWS staging, secrets, database migrations, backups, observability, rollback, and end-to-end acceptance before any production cutover.
- [ ] Keep Render production in place until migration is explicitly approved and rollback is proven.

## 9. Build reproducibility and static checks

- [ ] Add and commit package lockfiles for the API, web, and exchange-feed workspaces, then use deterministic `npm ci` installs in CI and deployment builds. The current repository tree contains no `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, or `yarn.lock`; CI and Render currently use `npm install`.
- [ ] Resolve API lint configuration: `apps/api/package.json` declares a lint script invoking ESLint, but ESLint is not declared in API devDependencies and the current CI workflow does not run that lint script.


## 10. Live Render PostgreSQL security audit — read-only findings (2026-11-19)

- [x] Confirm the current Render database record: `trademate-db`, PostgreSQL 18, free plan, Oregon, expires `2026-11-25T21:52:06.818364Z`; IP allowlist remains `0.0.0.0/0`. No database changes were made.
- [x] Inspect non-system PostgreSQL roles without retrieving credentials. The live database has the Render default database owner `trademate_db_jzjt_user` (LOGIN, CREATEDB, CREATEROLE, not superuser), `trademate_deletion_worker_ro` (LOGIN, not superuser), plus Render-managed roles. No dedicated `trademate_app` runtime role or `trademate_migrator` role exists.
- [x] Verify live ownership and grants: the default database user owns the public schema and all 50 application tables. It has broad table privileges and CREATEDB/CREATEROLE. The deletion worker role has SELECT grants only. Its membership is granted to the database owner with ADMIN OPTION. No migration-role split is deployed in the live database.
- [x] Verify production RLS state read-only: all 50 application tables have RLS disabled, RLS not forced, and zero policies. CI's disposable-database RLS pilot does not imply production RLS is enabled.
- [x] Compare live `schema_migrations` with branch migration files: production has applied migrations through `030_sports_transfer_external_player_discovery.sql`, including `024_usernames.sql`, but has not applied branch migration `025_ensure_public_profile_rows.sql`. This is expected branch-only remediation pending review/deployment; do not manually run it against production. It will backfill missing public profile rows, populate missing usernames, enforce NOT NULL, and add case-insensitive uniqueness/format constraints when deployed.
- [x] Inspect the CI RLS implementation: the API installs `databaseRequestContextMiddleware` and `createRlsAwarePool`, which sets transaction-local `app.session_token_hash` and `app.user_id` from the server-side session. The CI pilot enables policies on only five tables and tests explicit user contexts; it is not a complete production policy set.
- [ ] Before production RLS, complete the policy inventory for all sensitive tables, including the session-token bootstrap lookup on `user_sessions`, and verify unauthenticated/session-expired behavior. Test every endpoint and background worker with the actual `trademate_app` role; the current pilot does not cover all tables or the session bootstrap policy.
- [ ] Plan and approve a controlled production role migration: create a dedicated least-privilege application role, a separate migration owner/role, and an appropriately scoped deletion-worker role; grant only required schema/table/sequence/function privileges; rotate service connection strings securely; test on a staging clone; then separately plan RLS policy rollout. Do not attempt ad hoc live SQL changes.
- [ ] Verify live Render environment-variable names/role assignments. Render's available service metadata does not expose environment-variable names, so `DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `WORKER_DATABASE_URL` values/role targets remain unverified. Never retrieve or print secret values.
- [x] Inspect the scheduled `trademate-account-deletion-dry-run` cron source at its live deployed commit `492dea1d8d704288e9a53afddd94820431e8c618`: permanent processing requires both `ACCOUNT_DELETION_EXECUTE=true` and `ACCOUNT_DELETION_LEGAL_APPROVAL=true`; otherwise it is dry-run only. The production script requires `WORKER_DATABASE_URL`. The live worker role currently has SELECT-only grants, so it cannot perform the script's delete/update/insert operations if that is the configured URL.
- [x] Confirm the scheduled cron service is separately managed and absent from the checked-in `render.yaml`; it runs daily at 03:00 UTC, targets `main`, and its latest deployment is commit `492dea1d8d704288e9a53afddd94820431e8c618`. Its configuration therefore is not governed by the current Blueprint file.
- [ ] Verify the cron job's live environment-variable names and confirm both execution flags are not enabled; current Render service metadata does not expose env var names. Confirm the configured worker URL targets a deliberately scoped role. Do not trigger the cron job during this audit.
- [ ] Decide and test whether the deletion worker should remain permanently read-only/dry-run or receive a separate, narrowly scoped write role after legal/privacy/records-retention approval. Do not broaden the existing read-only role ad hoc.

## 11. Live Render deployment configuration — refreshed read-only check (2026-11-19)

- [x] Confirmed current service metadata: API and web remain `autoDeployTrigger=commit`; exchange-feed remains `checksPass`. All three target `main`; no preview services are enabled.
- [x] Confirmed web health path is empty; API health path is `/api/health`; exchange-feed health path is `/health`.
- [x] Confirmed API, web, exchange-feed, and the database all currently allow inbound IPv4 `0.0.0.0/0`. This is broad exposure; do not change without an approved access/availability plan.
- [ ] Reconcile live deployment triggers with the checked-in Blueprint after reviewing the risk of changing deployment behavior. No Render settings were changed.
- [ ] Add a web liveness endpoint only if required by the chosen platform health policy; validate it in staging before changing Render.

## Working rules

- Work on `fix/audit-remediation-2026-11-18`; keep `main` untouched.
- Fix and verify one bounded item at a time.
- Update this checklist as evidence is produced; never mark an item complete based only on code being written.
- No production database changes, deployment, merge, PR closure, secret changes, infrastructure provisioning, or AWS cutover without explicit approval.
- Never request or commit database URLs, passwords, API keys, or other secrets.
