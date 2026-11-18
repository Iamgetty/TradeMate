# TradeMate Audit Remediation Checklist

Baseline reviewed: `main` at `02d27f0313ca817b030c7fe2d2b8b5f5b9a692c1` (2026-11-18).

This checklist records the source/configuration audit findings. Items are not complete until the relevant code change, automated checks, and required runtime verification have passed. Do not merge or deploy without explicit approval.

## 1. Database migrations and profile integrity — code fix validated in CI

- [x] Update `apps/api/scripts/migrate.js` so migrations `024_usernames.sql` and `025_ensure_public_profile_rows.sql` are included and applied in the correct order.
- [x] Update `updateMyProfile()` in `apps/api/src/module.ts` so every profile-row insert satisfies the username NOT NULL constraint and username uniqueness rules.
- [x] Update the `test-rls-pilot.js` fixture to provide a valid username after migration 024.
- [x] Add a regression test that compares migration files with the runner's applied migration list, so future migrations cannot silently be skipped (runner fails fast on manifest mismatch).
- [x] Run clean-database migration integration tests and profile create/update tests (CI run `44409164204`, all 8 jobs passed, including the full database integration and browser acceptance jobs).
- [x] Review PR #216 against this branch's fix: it overlaps the migration registration and profile username insert, but omits the manifest guard and RLS fixture update. PR #219 contains the superset; leave #216 open and unmerged pending explicit PR housekeeping approval.

## 2. Database backup and restore verification — urgent operational item

- [ ] Complete a restore of the existing custom-format backup into the local disposable database `trademate_restore_test`.
- [ ] Verify restore exit status, expected schema/tables, representative row counts, and application-level connectivity.
- [ ] Record backup file size, archive validation result, restore result, and verification evidence without putting database URLs or passwords in chat or repository files.
- [ ] Confirm a recoverable backup before the Render database expiry on 2026-11-25.
- [ ] After backup/access needs are resolved, replace the broad database IP allowlist `0.0.0.0/0` with the narrowest practical allowlist.

## 3. Render deployment and health configuration

- [ ] Reconcile actual Render `autoDeployTrigger: commit` settings with `render.yaml` `checksPass` policy.
- [ ] Decide whether Render's health check should use a database-aware readiness endpoint; distinguish process liveness from database readiness.
- [ ] Reconcile the Blueprint's declared `MIGRATION_DATABASE_URL` with the API's required `DATABASE_URL`; verify actual service environment without exposing secret values.
- [ ] Measure web/API-to-exchange-feed cross-region latency and decide whether region alignment is warranted.
- [ ] Verify deployment commit SHAs and check results before treating a service as current or healthy.

## 4. Homepage animation and frontend behavior

- [x] Remove the unwanted legacy `.view.enter > *` entrance animation and its redundant override. The shared `@keyframes in` remains because other non-homepage screens (`.pgw`, `.lg`, and `#out`) still use it.
- [x] Preserve the existing boot-gate loader in `app/layout.tsx`; the homepage entrance selector is removed. Runtime refresh/navigation verification remains open.
- [x] Remove the remaining `.view.enter .mk-card` animation: those `.mk-card` elements are the Home marketplace shortcut tiles. Keep `.view.enter` animations scoped to market-page components that do not form the Home shortcuts.
- [ ] Add and pass a browser regression test that checks the served app bundle on initial load and refresh for both the broad legacy selector and the Home shortcut selector.
- [ ] Verify refresh, direct navigation, back/forward navigation, mobile layout, and reduced-motion behavior.
- [ ] Regression-test homepage carousel and Explore category interactions; distinguish the active homepage carousel from the currently unloaded `category-ads.js`.

## 5. Frontend/backend feature verification

- [ ] Build a feature-to-endpoint acceptance matrix for auth, profiles/follows, B2B listings/inventory, contracts, enquiries/messages, P2P lifecycle, feed, notifications/support, Forex, crypto spot, and NFT integration.
- [ ] Test each claimed server-backed workflow against the real API contract and persisted state.
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
