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
- [ ] Add a lightweight web-service liveness endpoint only if the web runtime/platform requires one; no dedicated web health endpoint was found in the inspected app routes.
- [x] Update the Render Blueprint to declare `DATABASE_URL` for the API runtime separately from `MIGRATION_DATABASE_URL` for migrations; both remain `sync: false`, and no secret values are stored in the repository.
- [ ] Verify the live API service has both variables configured and that they point to the intended roles/database, without exposing secret values.
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

## Working rules

- Work on `fix/audit-remediation-2026-11-18`; keep `main` untouched.
- Fix and verify one bounded item at a time.
- Update this checklist as evidence is produced; never mark an item complete based only on code being written.
- No production database changes, deployment, merge, PR closure, secret changes, infrastructure provisioning, or AWS cutover without explicit approval.
- Never request or commit database URLs, passwords, API keys, or other secrets.
