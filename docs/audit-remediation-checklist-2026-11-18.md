# TradeMate Audit Remediation Checklist

Baseline reviewed: `main` at `02d27f0313ca817b030c7fe2d2b8b5f5b9a692c1` (2026-11-18).

This checklist records the source/configuration audit findings. Items are not complete until the relevant code change, automated checks, and required runtime verification have passed. Do not merge or deploy without explicit approval.

## 1. Database migrations and profile integrity — code fix validated in CI

- [x] Update `apps/api/scripts/migrate.js` so migrations `024_usernames.sql` and `025_ensure_public_profile_rows.sql` are included and applied in the correct order.
- [x] Update `updateMyProfile()` in `apps/api/src/module.ts` so every profile-row insert satisfies the username NOT NULL constraint and username uniqueness rules.
- [x] Update the `test-rls-pilot.js` fixture to provide a valid username after migration 024.
- [x] Add a regression test that compares migration files with the runner's applied migration list, so future migrations cannot silently be skipped (runner fails fast on manifest mismatch).
- [x] Run clean-database migration integration tests and profile create/update tests (CI run `44425744634`, all 8 jobs passed). Revalidated the complete migration integration and browser acceptance jobs on latest branch commit `218c9d0b02f76aa0880d8f80380019f075255fe1` in CI run `44429637981` (8/8 jobs passed).
- [x] Review PR #216 against this branch's fix: it overlaps the migration registration and profile username insert, but omits the manifest guard and RLS fixture update. PR #219 contains the superset; leave #216 open and unmerged pending explicit PR housekeeping approval.

## 2. Database backup and restore verification — local restore proven (2026-11-19)

- [x] Confirmed the custom-format backup exists at the user's local path `Documents/TradeMate-Backups/trademate-backup.dump`; file size is 440,829 bytes (modified 2026-11-18 22:16 local time). No credentials or database URLs were recorded.
- [x] Confirmed PostgreSQL 18 `pg_restore --list` can read the archive; the archive listing contains table-data and constraint entries.
- [x] Restored the exact backup into a fresh, separate local verification database `trademate_restore_verify_20261119`; `pg_restore --exit-on-error` returned exit code 0.
- [x] Queried the fresh verification database and confirmed 50 public base tables. A prior local test database also contained 50 tables, 35 migration records, representative application rows, 133 index entries, zero invalid/unready indexes, and zero unvalidated foreign keys; its provenance was not relied upon for the independent restore proof.
- [x] Confirmed the restored `audit_events.id` identity generator resolves to `public.audit_events_id_seq`.
- [ ] Application-level connectivity and full source-to-restore row-by-row/data-equivalence comparison were not performed; the successful clean restore proves archive recoverability and schema restoration, not exact data equivalence.
- [x] Confirmed a recoverable local backup before the Render database expiry on 2026-11-25. Keep the original dump and restore-verification log safe; do not delete the verification database until a separate retention decision.
- [ ] After backup/access needs are resolved, replace the broad database IP allowlist `0.0.0.0/0` with the narrowest practical allowlist.

## 3. Render deployment and health configuration

- [ ] Reconcile actual Render `autoDeployTrigger: commit` settings with `render.yaml` `checksPass` policy.
- [x] Read-only live audit (2026-11-19): web and API use `commit`; exchange-feed uses `checksPass`. Web has no health-check path; API uses `/api/health`; feed uses `/health`. No live settings were changed.
- [x] Record live deployment SHAs: web `02d27f0313ca817b030c7fe2d2b8b5f5b9a692c1`, API `d743ab1bc782676e6e35af6a3c234f94bbc6cf19`, exchange-feed `a3733604e58182d02b1891f595a5f75d399a2e3e`. These differ because the services have separate deployment histories; confirm compatibility before aligning them.
- [ ] Review whether web health checks should use a lightweight web liveness endpoint; do not point web at the API health endpoint without confirming service boundaries.
- [x] Verify API health route mapping: Nest applies the `/api` global prefix, so Render's `/api/health` maps to the liveness-only `HealthController.health()` route. `/api/health/database` separately performs `SELECT 1`; it is database readiness/diagnostics, not the configured liveness check.
- [ ] Decide whether API deployment readiness should depend on database connectivity; assess startup/migration behavior and outage policy before changing health checks.
- [x] Close the production migration-role fallback: source audit found the migration runner could fall back to the runtime `DATABASE_URL`, while production validation did not require `MIGRATION_DATABASE_URL`. The runner now requires the dedicated migration URL in production; API environment validation also requires it, and a regression test verifies production refuses the fallback. Validated by CI run `44427485813`; revalidated on latest branch commit `218c9d0b02f76aa0880d8f80380019f075255fe1` in run `44429637981` (8/8 jobs passed), with Cloudflare compatibility passing in run `44429638060`.
- [ ] Add a lightweight web-service liveness endpoint only if the web runtime/platform requires one; no dedicated web health endpoint was found in the inspected app routes.
- [x] Update the Render Blueprint to declare `DATABASE_URL` for the API runtime separately from `MIGRATION_DATABASE_URL` for migrations; both remain `sync: false`, and no secret values are stored in the repository.
- [ ] Verify the live API service has both variables configured and that they point to the intended roles/database, without exposing secret values. The Render service-details response does not expose environment-variable names, so presence/role assignment remains unverified; do not infer it from Blueprint declarations.
- [ ] Measure web/API-to-exchange-feed cross-region latency and decide whether region alignment is warranted.
- [ ] Verify deployment commit SHAs and check results before treating a service as current or healthy.

## 4. Homepage animation and frontend behavior

- [x] Remove the unwanted legacy `.view.enter > *` entrance animation and its redundant override. The shared `@keyframes in` remains because other non-homepage screens (`.pgw`, `.lg`, and `#out`) still use it.
- [x] Preserve the existing boot-gate loader in `app/layout.tsx`; the homepage entrance selector is removed. Runtime refresh/navigation verification remains open.
- [x] Remove the remaining `.view.enter .mk-card` animation: those `.mk-card` elements are the Home marketplace shortcut tiles. Keep `.view.enter` animations scoped to market-page components that do not form the Home shortcuts.
- [x] Add and pass a browser regression test that checks the served app bundle on initial load and refresh for both the broad legacy selector and the Home shortcut selector (CI run `44412507433`); browser acceptance also passed on latest branch commit in run `44429637981`.
- [ ] Verify refresh, direct navigation, back/forward navigation, mobile layout, and reduced-motion behavior.
- [ ] Regression-test homepage carousel and Explore category interactions; distinguish the active homepage carousel from the currently unloaded `category-ads.js`.

## 5. Frontend/backend feature verification

- [x] Create the initial source-level feature-to-endpoint acceptance matrix at `TradeMate-main/docs/feature-endpoint-acceptance-matrix-2026-11-19.md`; detailed workflow tests and provider/runtime acceptance remain open.
- [ ] Test each claimed server-backed workflow against the real API contract and persisted state.
- [x] Verify the new NFT provider timeout/resilience tests in CI; all five route-level tests passed in CI run `44425744634` browser acceptance job (39 E2E tests passed total). The latest branch commit's browser acceptance job also passed in run `44429637981`. `/api/nfts` and `/api/nft-collections` apply 8-second abort timeouts to all OpenSea requests.
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

- [x] Refresh open-PR inventory on 2026-11-19 (GitHub mergeability snapshot; mergeability can change):
  - #216 open, mergeable, overlaps migration/profile changes; #219 supersets the migration manifest guard and RLS fixture fix. Keep #216 unmerged pending explicit housekeeping approval.
  - #213 open, mergeable, targets `main`; review its governance reconciliation before any Sports Transfer merge.
  - #171 open, not mergeable, targets `main`; #172 and #173 remain stacked on #171/#172 respectively. Do not merge the chain blindly.
  - #176, #147, #142, #131, and #130 open, not mergeable.
  - #146 and #134 open, mergeable; still require content/overlap/CI review before merge.
  - #209, #214, #215, and #218 remain previously merged.
- [x] Inspect changed files for #213, #146, and #134. PR #213 adds an API `package-lock.json` and changes the API Docker build to `npm ci`, but its lockfile root includes `@nestjs/cli` and `@nestjs/schematics` as devDependencies that are absent from the current API `package.json`. Treat that lockfile as out of sync; regenerate/validate it before adopting the `npm ci` change. #146 is a single browser scroll-anchor assertion adjustment; #134 adds a production data-integrity document and roadmap reference.
- [x] Rechecked PR CI evidence on 2026-11-19: #213 head `5456c637b6edea48234713204a77206cfbb1dcb3` fails API TypeScript build, clean-database migration integration, AWS API container build, and the browser acceptance job (which stops at API build); its web, Cloudflare, security, and exchange-feed jobs pass. The changed API lockfile is out of sync with the package manifest, so do not merge or adopt its `npm ci` changes until regenerated and the failing build is diagnosed. #146 head `bb67ebbb9e2bad58676604bfcc4302300dbe1758` passes 8/9 jobs but its browser app-shell/live API acceptance job fails during the mocked smoke/live two-account acceptance step; inspect that failure before adopting the timing assertion change. #134 head `5af8410167ecb380e9977dd272e401793330f6f7` passes all 8 reported jobs and adds only a production data-integrity document plus roadmap reference; its policy is useful, but the PR remains separately reviewable and is not merged. These PRs were not modified or merged.
- [ ] Reassess non-mergeable PRs #176, #147, #171, #172, #173, #142, #131, and #130; decide rebase, retarget, close, or retain only after explicit approval.
- [ ] No PR merge, close, retarget, or branch deletion without explicit approval.

## 8. AWS/Cloudflare migration readiness — no cutover yet

- [ ] Resolve documentation disagreement about Render as current production versus AWS as target.
- [ ] Verify Cloudflare Workers adapter compatibility, including the API proxy route currently declaring `runtime = 'nodejs'`.
- [ ] Validate AWS staging, secrets, database migrations, backups, observability, rollback, and end-to-end acceptance before any production cutover.
- [ ] Keep Render production in place until migration is explicitly approved and rollback is proven.

## 9. Build reproducibility and static checks

- [ ] Add and commit package lockfiles for the API, web, and exchange-feed workspaces, then use deterministic `npm ci` installs in CI and deployment builds. Rechecked the full review-branch Git tree on 2026-11-19: no `package-lock.json` files are present. CI and Render currently use `npm install`. Do not copy PR #213's API lockfile as-is: its root devDependency set does not match the current API `package.json`.
- [ ] Resolve API lint configuration: `TradeMate-main/apps/api/package.json` declares `"lint": "eslint ..."`, but ESLint is not declared in its dependencies/devDependencies, no ESLint config file is present in the review-branch tree, and the current CI workflow does not run that lint script. The web `lint` script is TypeScript no-emit checking; exchange-feed uses Node's built-in test runner. Add a deliberate lint toolchain and validate it before marking this complete.


## 10. Live Render PostgreSQL security audit — read-only findings (2026-11-19)

- [x] Confirm the current Render database record: `trademate-db`, PostgreSQL 18, free plan, Oregon, expires `2026-11-25T21:52:06.818364Z`; IP allowlist remains `0.0.0.0/0`. No database changes were made.
- [x] Inspect non-system PostgreSQL roles without retrieving credentials. The live database has the Render default database owner `trademate_db_jzjt_user` (LOGIN, CREATEDB, CREATEROLE, not superuser), `trademate_deletion_worker_ro` (LOGIN, not superuser), plus Render-managed roles. No dedicated `trademate_app` runtime role or `trademate_migrator` role exists.
- [x] Verify live ownership and grants: the default database user owns the public schema and all 50 application tables. It has broad table privileges and CREATEDB/CREATEROLE. The deletion worker role has SELECT grants only. Its membership is granted to the database owner with ADMIN OPTION. No migration-role split is deployed in the live database.
- [x] Verify production RLS state read-only: all 50 application tables have RLS disabled, RLS not forced, and zero policies. CI's disposable-database RLS pilot does not imply production RLS is enabled.
- [x] Compare live `schema_migrations` with branch migration files: production has applied migrations through `030_sports_transfer_external_player_discovery.sql`, including `024_usernames.sql`, but has not applied branch migration `025_ensure_public_profile_rows.sql`. This is expected branch-only remediation pending review/deployment; do not manually run it against production. It will backfill missing public profile rows, populate missing usernames, enforce NOT NULL, and add case-insensitive uniqueness/format constraints when deployed.
- [x] Inspect the CI RLS implementation: the API installs `databaseRequestContextMiddleware` and `createRlsAwarePool`, which sets transaction-local `app.session_token_hash` and `app.user_id` from the server-side session. The CI pilot enables policies on only five tables and tests explicit user contexts; it is not a complete production policy set.
- [ ] Before production RLS, complete the policy inventory for all sensitive tables, including the session-token bootstrap lookup on `user_sessions`, and verify unauthenticated/session-expired behavior. Test every endpoint with the actual `trademate_app` role; the current pilot does not cover all tables or the session bootstrap policy.
- [ ] Design explicit least-privilege RLS access for the account-deletion background worker. It runs outside `databaseRequestContextMiddleware` and cannot rely on request-local `app.user_id`; once RLS is enabled/forced, its due-request lookup and narrowly scoped anonymisation operations need dedicated worker policies or another reviewed mechanism. Do not grant BYPASSRLS as a shortcut.
- [ ] Plan and approve a controlled production role migration: create a dedicated least-privilege application role, a separate migration owner/role, and an appropriately scoped deletion-worker role; grant only required schema/table/sequence/function privileges; rotate service connection strings securely; test on a staging clone; then separately plan RLS policy rollout. Do not attempt ad hoc live SQL changes.
- [ ] Verify live Render environment-variable names/role assignments. Render's available service metadata does not expose environment-variable names, so `DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `WORKER_DATABASE_URL` values/role targets remain unverified. Never retrieve or print secret values.
- [x] Inspect the scheduled `trademate-account-deletion-dry-run` cron source at its live deployed commit `492dea1d8d704288e9a53afddd94820431e8c618`: permanent processing requires both `ACCOUNT_DELETION_EXECUTE=true` and `ACCOUNT_DELETION_LEGAL_APPROVAL=true`; otherwise it is dry-run only. The production script requires `WORKER_DATABASE_URL`. The live worker role currently has SELECT-only grants, so it cannot perform the script's delete/update/insert operations if that is the configured URL.
- [x] Confirm the scheduled cron service is separately managed and absent from the checked-in `render.yaml`; it runs daily at 03:00 UTC, targets `main`, and its latest deployment is commit `492dea1d8d704288e9a53afddd94820431e8c618`. Its configuration therefore is not governed by the current Blueprint file.
- [x] Verify the most recent available cron run log (2026-11-18 03:01 UTC): run completed successfully, reported 0 due requests, and explicitly logged `Dry run only`; this confirms permanent processing was disabled for that run. Do not generalize this to future runs if environment settings change.
- [ ] Verify the cron job's live environment-variable names and confirm both execution flags remain disabled; current Render service metadata does not expose env var names. Confirm the configured worker URL targets a deliberately scoped role. Do not trigger the cron job during this audit.
- [x] Fix the checked-in future `trademate_worker` bootstrap grants: the worker's DELETE/UPDATE statements filter on `user_id`, `sender_user_id`, and `accepted_by_user_id`, which also require SELECT on those predicate columns in PostgreSQL. Added narrow column-level SELECT grants and extended `002_role_bootstrap_test.sql` to assert them. This is a CI/bootstrap-code fix only; no live roles or grants were changed.
- [ ] Decide and test whether the deletion worker should remain permanently read-only/dry-run or receive a separate, narrowly scoped write role after legal/privacy/records-retention approval. Do not broaden the existing live read-only role ad hoc.

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


## 12. API lint and dependency reproducibility — follow-up audit (2026-11-19)

- [x] Re-inspect `TradeMate-main/apps/api/package.json` on the review branch: the `lint` script invokes ESLint, but `eslint` is not declared in either `dependencies` or `devDependencies`.
- [x] Check the expected API ESLint configuration paths (`.eslintrc.js` and `eslint.config.js`); neither exists at the API root. The lint script is therefore not a validated quality gate and may fail before checking source files.
- [x] Confirm `TradeMate-main/apps/api/package-lock.json` is absent on the review branch. Do not copy PR #213's stale lockfile: its root dependency declarations do not match the current API manifest. A lockfile must be generated from the reviewed manifest and validated with a clean `npm ci` install before adoption.
- [ ] Select and pin a compatible ESLint/tooling configuration for the API's TypeScript version and module format; add the required parser/plugin/config dependencies and a repository-owned config, or remove the misleading lint script until a real lint gate is implemented. Validate against the actual source tree and CI runner.
- [ ] Generate and commit an API lockfile from the final manifest using the intended Node/npm versions; prove clean install and build using `npm ci`. Repeat separately for web and exchange-feed if those workspaces are intended to be reproducible.
- [x] Freshly inspect PR #219 CI run 1525 (run ID `44435308255`) for code commit `1f67e94f79d64609a277020e3602e7f6c1a22b0a`: Cloudflare compatibility, API TypeScript build, database migration integration, container builds, web build/runtime syntax, exchange-feed/MT5 tests, and security scanning passed. The browser app-shell/live API acceptance job ended `cancelled`, not passed; therefore this run is not a full green CI result.
- [x] Rechecked PR #219 head `6256eb13affb660521a2abdda255b3bc6eab9c27`: TradeMate CI run 1527 (ID `44435758010`) completed successfully with all 8/8 jobs passing, including browser app-shell/live two-account API acceptance and SAST/SCA/secret scanning. Cloudflare compatibility run 343 (ID `44435757991`) also passed. This supersedes the incomplete run 1525 status for the current branch head; API lint and lockfile tasks above remain open.

## 13. Latest PR-head CI confirmation (2026-11-19)

- [x] Rechecked exact latest PR head `74100949d1aac560484dc3e6bdd95a708215462c`: TradeMate CI run 1529 (ID `44436629596`) completed with all 8/8 jobs successful. This includes API TypeScript build/security validation, clean PostgreSQL migration integration and role/RLS tests, exchange-feed/MT5 tests, web build/runtime checks, browser app-shell plus mocked and live two-account API acceptance, isolated Cloudflare Workers build/runtime, SAST/SCA/secret scanning, and AWS API/exchange-feed container builds.
- [x] Confirmed browser acceptance job `135267006668` completed successfully; the migration integration job `135267006888` and security scan job `135267006723` also passed.
- [x] Cloudflare frontend compatibility run 345 (ID `44436629633`) completed successfully on the same latest PR head.
- [ ] API lint remains unconfigured and is not run by CI. ESLint is absent from API dependencies and no API ESLint config exists.
- [ ] API, web, and exchange-feed lockfiles remain absent; deterministic `npm ci` validation remains outstanding. Do not adopt PR #213's stale API lockfile.
- [ ] This CI result validates the checked-in CI suite, not production Render configuration, production PostgreSQL roles/RLS, or deployment readiness. No production changes were made.


## 14. Latest review-branch CI confirmation (2026-11-19)

- [x] Rechecked exact latest PR #219 head `bad9c94e7aa176d074d9be194a331a994cac3fc5`: TradeMate CI run 1530 (ID `44437003928`) completed successfully. All eight reported jobs passed.
- [x] Cloudflare frontend compatibility run 346 (ID `44437003920`) completed successfully on the same head.
- [ ] API lint remains unconfigured and is not run by CI. ESLint is absent from API dependencies and no API ESLint config exists.
- [ ] API, web, and exchange-feed lockfiles remain absent; deterministic `npm ci` validation remains outstanding. Do not adopt PR #213's stale API lockfile.
- [ ] These CI results validate the checked-in CI suite, not production Render configuration, production PostgreSQL roles/RLS, or deployment readiness. No production changes were made.


## 15. Reproducibility toolchain alignment — source inspection (2026-11-19)

- [x] Re-inspected the three package manifests on the current review branch. API uses TypeScript 5.7.2, NestJS 11.2.8, CommonJS, and has an ESLint script but no ESLint dependency. Web uses Next 16.4.3, React 19.3.1, TypeScript 5.7.2, and Playwright 1.56.1; its `lint` script is `tsc --noEmit`. Exchange-feed has only `ws` as a runtime dependency and uses Node's built-in test runner.
- [x] Compared execution runtimes: the primary CI jobs install with Node 20; the API and exchange-feed Dockerfiles build/run on Node 22; the isolated Cloudflare compatibility job uses Node 22. The lockfile/toolchain plan must explicitly choose and test supported Node/npm versions rather than assume these environments are interchangeable.
- [x] Confirmed API and exchange-feed Dockerfiles copy `package*.json` and run `npm install`; adding a lockfile alone will not make builds deterministic until Docker install commands and CI install commands are deliberately switched to `npm ci` and validated.
- [ ] Decide and document a supported Node/npm matrix for API, web, exchange-feed, CI, Docker, and Render before generating lockfiles. Check framework and dependency engine requirements against that matrix.
- [ ] Generate each lockfile using the selected npm version, then validate clean `npm ci`, build/tests, security audit, and container builds in the corresponding Node runtime. Do not mark complete based on a lockfile being present.
- [ ] Only after clean validation, update CI and Docker install commands to `npm ci`; preserve separate production `--omit=dev` install behavior where required and test the resulting images.


## 16. Render Node runtime pinning — deployment source audit (2026-11-19)

- [x] Re-inspected the review-branch `TradeMate-main/render.yaml`: all three Render services declare `runtime: node` but do not pin a Node version in the Blueprint or a checked-in `.node-version`/`.nvmrc` file at the inspected locations.
- [x] Confirmed the Blueprint build commands use `npm install` for API, web, and exchange-feed. The API and exchange-feed Dockerfiles use Node 22, while primary CI jobs currently use Node 20 and the isolated Cloudflare compatibility job uses Node 22.
- [ ] Select one supported Node major for all three services and CI. Node 22 is the leading alignment candidate because both runtime Dockerfiles and the Cloudflare compatibility job already use it; verify framework engine constraints and Render's supported Node version mechanism before pinning.
- [ ] Pin the selected Node version for Render and local development (for example, a repository `.node-version` plus an explicit Render `NODE_VERSION` setting if supported), then validate all builds/tests and production startup on that exact major before deployment.
- [ ] Keep the live Render services unchanged until this has been validated and separately approved. This is a source configuration finding only; no live Render settings were changed.


## 17. Node runtime compatibility and Render pinning mechanism — documentation verification (2026-11-19)

- [x] Verified from the official Next.js 16 upgrade guide that Next.js 16 requires Node.js 20.9 or later. This makes Node 22 compatible with the declared framework minimum; it does not by itself certify every dependency or the full application on Node 22.
- [x] Verified from current Render documentation that native Node services can be pinned, in precedence order, with the service's `NODE_VERSION` environment variable, a repository-root `.node-version`, a root `.nvmrc`, or a bounded `engines.node` range. Render recommends an upper bound for ranges and documents the Blueprint `NODE_VERSION` environment variable.
- [x] Confirmed that the current Render default is Node 24.22.1 for services created on/after 2026-10-21; older services can retain different defaults. Therefore the existing unpinned Render services must not be assumed to use Node 22 or the same Node major as CI/Docker.
- [x] Node 22 remains the best alignment candidate from repository evidence: API and exchange-feed Dockerfiles use Node 22; Cloudflare compatibility CI uses Node 22; Next.js 16's documented minimum is Node 20.9. Primary CI currently uses Node 20 and must be aligned only after an exact Node/npm version is selected and validated.
- [x] Identified an exact Node 22 candidate from the official Node.js release archive: Node 22.23.5 (published 2026-11-11), bundled npm 10.9.9. The official Node.js security release notice identifies this as the current 22.x security release at the time of this audit. This is the proposed pin, not yet an adopted or tested toolchain.
- [ ] Verify the Node 22.23.5 patch is accepted by Render's native runtime and all dependency engine constraints; then, in a real checkout/build environment, align primary CI, all three Render services, Docker build/runtime images, and local development on Node 22.23.5/npm 10.9.9. Run clean installs, API/web/feed builds and tests, and container builds before changing deployment configuration.
- [ ] No `.node-version`, `.nvmrc`, `engines`, CI runtime, Docker image, or live Render setting was changed as part of this documentation-only verification.


## 18. API lint scope review — source inspection (2026-11-19)

- [x] Inspected the API TypeScript configuration: strict TypeScript is enabled; compiler module is CommonJS; target is ES2021; production build includes `src/**/*.ts` and excludes tests/spec files.
- [x] Enumerated the API source tree on the review branch: ten TypeScript source files are currently present under `src`; the largest is `src/module.ts` (approximately 252 KB). The API test suite is JavaScript `.cjs` and is exercised separately with Node's built-in test runner.
- [x] Confirmed the existing lint glob `eslint "{src,apps,libs,test}/**/*.ts"` does not accurately describe the current API project layout: the checked API root has `src` and `test`, but no `apps` or `libs` directories, and the test files are `.cjs`, not TypeScript. A future lint script should target the actual TypeScript source and explicitly define whether test/config TypeScript is in scope.
- [ ] Implement a pinned ESLint 9 + typescript-eslint flat-config setup only after it can be installed and executed against the full API source tree. Select rules deliberately; do not enable broad type-aware or stylistic rules without checking compatibility and existing code findings.
- [ ] Run lint against all ten source files, resolve or explicitly justify findings, then add the lint command to CI. The GitHub file-editing connection does not provide a repository checkout or Node/npm execution, so no lint package/config changes are claimed as validated in this audit.
- [ ] Keep the existing API TypeScript build and security tests as separate gates; passing them does not mean ESLint is configured or passing.


## 19. API security source review — public market WebSocket resource controls (2026-11-19)

- [x] Inspected the market-feed upgrade handler and subscription lifecycle in `apps/api/src/market-feed.ts`.
- [x] Confirmed the WebSocket endpoint is intentionally public market data, but the upgrade path currently has no explicit Origin allowlist, authentication, per-IP connection cap, global session cap, subscription rate limit, or idle-client timeout.
- [x] A single accepted subscription opens multiple upstream venue WebSockets (two or three depending on the symbol) and emits a snapshot every second. There is no explicit `bufferedAmount` backpressure guard before sending snapshots. Consequently, a high number of clients or slow-reading clients can amplify resource consumption on the API and upstream connections.
- [x] Client message size is bounded (`maxPayload: 16 KiB`) and symbol syntax is constrained, but these controls do not cap the number of accepted clients or upstream subscriptions.
- [ ] Add a documented public-feed capacity policy: per-IP and global connection limits, per-connection subscription limit, handshake Origin validation for browser clients (as a CSWSH defense, not as authentication), idle/heartbeat handling, upstream connection budget, and `bufferedAmount` backpressure/drop behavior.
- [ ] Add regression tests for rejected origins, connection/session caps, reconnect cleanup, slow-client backpressure, and bounded upstream sockets; verify legitimate browser market-feed subscriptions still work.
- [ ] Do not make the endpoint private merely to mitigate abuse: market data is public functionality. Apply explicit limits and monitor connection counts instead.
- [ ] No runtime WebSocket behavior was changed during this source-only audit; these are confirmed code-level hardening gaps requiring implementation and executable validation.

## 20. API security source review — authentication and query boundaries (2026-11-19)

- [x] Reviewed password hashing (scrypt), constant-time password/TOTP comparisons, hashed opaque session/reset tokens, short-lived one-use verification/reset challenges, login/password-reset rate-limit records, and server-side session revocation flows.
- [x] Confirmed API SQL values in inspected authentication and market activity queries are parameterized; dynamic market activity filters are selected from fixed allowlists and the limit placeholder is generated from the number of bound values.
- [x] Confirmed login rate limiting is keyed by IP plus normalized email, and the second-factor challenge has both a per-challenge attempt ceiling and a per-IP/user rate-limit record.
- [x] Confirmed the account-deletion worker is guarded by separate execution and legal-approval flags; its production database URL cannot fall back to the API runtime URL.
- [ ] Review all remaining 4,000+ lines of `module.ts` route-by-route for authorization/ownership checks, moderation boundaries, mass assignment, and transaction consistency. The sampled review is not a full endpoint security certification.
- [ ] Review WebSocket Origin behavior against the actual production web origin and reverse-proxy configuration; ensure trusted proxy settings cannot permit client spoofing of `request.ip` for rate limiting.
- [ ] Verify all login, password reset, email verification, 2FA and deletion cancellation rate-limit paths under concurrency and confirm expired `auth_rate_limits`/challenge rows are cleaned up safely.
- [ ] No authentication or endpoint code was changed as part of this review entry.


## 21. Public market-feed WebSocket capacity controls — implementation added (2026-11-19)

- [x] Added an explicit per-instance ceiling of 100 concurrent WebSocket clients and a per-client-IP ceiling of 5.
- [x] Added browser Origin allowlisting for the deployed TradeMate web origin, localhost development, and normalized comma-separated `WEB_ORIGIN` values. Requests without an Origin remain permitted for non-browser clients; an unexpected or malformed browser Origin is rejected before upgrade.
- [x] Per-IP accounting uses the right-most valid `X-Forwarded-For` address, consistent with the API's existing one-hop trusted-proxy setting in `main.ts`; invalid forwarding data falls back to the transport peer address.
- [x] Added a 10-second subscription deadline, one symbol per connection, and a 30-second ping/pong heartbeat that terminates unresponsive clients.
- [x] Added snapshot backpressure handling: skip sends while buffered output exceeds 1 MiB and close a client after 3 consecutive over-limit snapshots.
- [x] Added cleanup for upstream connection timeouts and Bybit ping intervals when sessions stop, preventing timers from surviving client disconnects.
- [x] Added a 10-second upstream WebSocket handshake timeout and exponential reconnect backoff (1–30 seconds, with jitter), resetting the backoff after a successful connection to reduce venue reconnect storms.
- [x] Added `market-feed.test.cjs` coverage for allowed/blocked origins, configured-origin normalization, trusted proxy client-IP selection, and explicit resource ceilings.
- [x] Added `market-feed.integration.test.cjs` coverage that opens real local WebSocket connections and verifies rejection of an untrusted Origin and the fifth-to-sixth per-IP connection boundary.
- [x] API TypeScript build and database-backed API integration suite completed successfully on commit `e8dc171c8d233b752aab1b57968f7309e4a62b97` in TradeMate CI run 1560 (all 8/8 jobs passed).
- [ ] Add live WebSocket integration tests for slow-client closure, heartbeat termination, subscription timeout, and upstream cleanup; those behaviors currently have implementation but not dedicated socket-level regression coverage.
- [ ] Validate the Render edge proxy's actual `X-Forwarded-For` behavior before rollout. The current per-IP quota assumes the one trusted proxy hop configured in `main.ts` appends the connecting client IP as the right-most value.
- [ ] Capacity values are conservative initial per-instance ceilings, not production load-test results. Revisit after observing real concurrent-client and upstream-connection metrics.
- [ ] No production deployment, Render setting, or live service was changed.


## 22. Sports Transfer mandate confidentiality — organization membership scope (2026-11-19)

- [x] Reviewed player profile consent ownership, mandate creation, representative acceptance/rejection, mandate revocation, organization membership management, and opportunity ownership checks.
- [x] Found that `GET /api/sports-transfer/mandates/mine` exposed organization-represented mandates to any membership marked active, although mandate acceptance is restricted to active owners/admins. The list query also needed to enforce the same role boundary as the response action.
- [x] Restricted organization-side mandate visibility to active owner/admin memberships with valid `starts_at` and `expires_at` windows, matching the existing `canRespond` authorization rule. Directly appointed individual representatives retain access to their own mandates.
- [x] Extended the database-backed Sports Transfer mandate HTTP integration test to verify active owner/admin visibility and denial for ordinary members, expired admins, future-dated admins, and outsiders.
- [x] Latest review-branch commit `c2fb08c473c2e263703205785f46ed93c94cbd30`: TradeMate CI run 1552 (`44439610122`) passed all 8/8 jobs, including the updated database-backed Sports Transfer mandate integration cases; Cloudflare compatibility run 368 (`44439610108`) passed.
- [ ] Continue auditing other Sports Transfer reads for equivalent role/date-scope mismatches. This is a targeted source finding, not a certification of the entire Sports Transfer module.


## 23. Sports Transfer organization owner-role assignment — schema boundary regression test (2026-11-19)

- [x] Reviewed the organization membership invitation schema and confirmed it explicitly excludes the `owner` role; ownership can only be established when an organization is created. The route separately restricts admin invitations to owners.
- [x] The first added test incorrectly expected HTTP 403 for an owner-role invitation. TradeMate CI run 1556 reached the organization integration test and correctly returned HTTP 400 because Zod rejects the role before route authorization. The source guard was restored to its original, schema-aligned behavior; no owner-escalation vulnerability was established by this test.
- [x] Updated the regression assertion to require HTTP 400 and document that owner assignment is rejected by the invitation schema.
- [x] Corrected schema-boundary assertion and checklist passed full TradeMate CI run 1560 on commit `e8dc171c8d233b752aab1b57968f7309e4a62b97` (8/8 jobs), including database migration integration; Cloudflare compatibility run 376 passed.
- [ ] Continue auditing organization-role changes, membership reactivation, and all organization-scoped opportunity/document actions for independent privilege escalation paths.


## 24. Latest review-branch verification and continued Sports Transfer access review (2026-11-19)

- [x] Verified PR #219 head commit `e8dc171c8d233b752aab1b57968f7309e4a62b97` remains open, draft, unmerged, and mergeable.
- [x] TradeMate CI run 1560 (`44440391941`) completed successfully: all 8/8 jobs passed, including API TypeScript build, database migration integration, web build/runtime, security scanning, container builds, exchange-feed/MT5 tests, and browser app-shell/live API acceptance.
- [x] Cloudflare frontend compatibility run 376 (`44440391933`) completed successfully.
- [x] Re-reviewed Sports Transfer organization membership routes, mandate inbox visibility, private opportunity creation/listing, and organization-scoped role/date checks. Opportunity creation requires active, in-window membership with a recruitment-capable role and workspace/recruitment scope; organization opportunity listing applies active membership, role, scope, and date-window predicates.
- [x] Existing opportunity integration test covers player-owned versus organization-owned drafts, outsider denial, and access removal after membership revocation. Mandate integration test covers owner/admin visibility and denial for ordinary, expired, future-dated, and outsider memberships.
- [ ] Continue a separate review of all read and write paths for organization documents, negotiation, offer, and opportunity lifecycle actions before treating Sports Transfer authorization as fully audited. Current opportunity API exposes private draft creation and owner-scoped listing; it does not provide publish/edit/delete routes in this controller.
- [ ] Add socket-level WebSocket tests for slow-client closure, heartbeat termination, subscription timeout, and upstream cleanup; CI passing does not replace these missing targeted tests or a Render proxy/load validation.


## 25. Sports Transfer organization-manager date-window regression coverage (2026-11-19)

- [x] Extended the database-backed organization HTTP integration test with active-status admin rows whose membership windows are expired or future-dated.
- [x] Added assertions that both expired and future-dated admins receive HTTP 403 for member listing and membership invitations; this exercises the shared manager-role date-window guard.
- [ ] Run the updated organization integration test and full CI on this commit before treating the new regression cases as verified.


## 26. Sports Transfer organization notification audience — membership date-window enforcement (2026-11-19)

- [x] Reviewed organization-member acceptance and organization-representative mandate notification recipient queries.
- [x] Found two notification queries that selected active owner/admin rows without checking `starts_at`; one also omitted an expiry check. This could send organization activity notices to future-dated or expired managers even though those memberships cannot currently manage the organization or access its mandate inbox.
- [x] Added both `starts_at IS NULL OR starts_at <= now()` and `expires_at IS NULL OR expires_at > now()` predicates to each manager-notification recipient query.
- [x] Extended the database-backed organization integration test to assert that expired and future-dated admins do not receive new-member notifications.
- [x] Extended the database-backed mandate integration test to assert that active owner/admin members receive organization mandate notices while ordinary members, expired admins, and future-dated admins do not.
- [ ] Run full CI on the resulting commit before treating these changes as validated.
- [ ] Continue the separate audit of Sports Transfer document access and all remaining organization-scoped actions. This notification fix does not certify document authorization.
- [ ] No production database, service, or deployment was changed.

## 27. Sports Transfer mandate revocation notification audience (2026-11-19)

- [x] Reviewed organization mandate revocation notification recipients.
- [x] Found the revocation notification query selected active owner/admin memberships but did not enforce membership start and expiry timestamps.
- [x] Added both membership-window predicates, matching the invitation-acceptance and mandate-creation notification queries.
- [x] Extended the database-backed mandate integration test to verify current owners/admins receive revocation notices and ordinary, expired, and future-dated members do not.
- [ ] Run full CI on the resulting commit before treating this change as validated.
- [ ] Continue authorization review for the complete Sports Transfer opportunity lifecycle and any future document routes.
- [ ] No production services or database were changed.


## 28. Sports Transfer opportunity authorization and lifecycle review (2026-11-19)

- [x] Re-reviewed the opportunity creation request schema: it strictly validates allowed fields, sport/movement compatibility, exactly one owner (player profile or organization), visibility, and structured financial terms.
- [x] Re-reviewed player-owned creation: the profile is selected by both profile ID and authenticated user ID under row lock, and the opportunity sport must match the profile.
- [x] Re-reviewed organization-owned creation: the organization must exist, and the creator must hold an active recruitment-capable membership with workspace/recruitment scope and a currently valid start/expiry window.
- [x] Re-reviewed `GET /sports-transfer/opportunities/mine`: player records are scoped to profiles owned by the authenticated user; organization records require active, in-window membership, an allowed role, and workspace/recruitment scope.
- [x] Confirmed migration 029 enforces exactly one owner, sport-specific movement types, bounded fields, allowed visibility/status values, and states that drafts are private and unpublished. No public discovery or publication transition is implemented in this controller.
- [x] Confirmed this controller currently exposes draft creation and owner-scoped listing only; no edit, delete, submission, publication, pause, or close endpoint was found. This is a product lifecycle limitation, not an authorization defect to patch by inventing endpoints.
- [ ] Continue the separate audit of document authorization and any negotiation/offer endpoints outside this controller before declaring Sports Transfer authorization fully reviewed.
- [x] Latest head `1103d188e2915ba08dc643b88c7bcfb2f3feb711` passed TradeMate CI #1570 and Cloudflare compatibility #386.
- [x] No production services, deployments, or databases were changed.


## 29. Organization verification documents and Sports Transfer document-surface review (2026-11-19)

- [x] Reviewed the legacy `/api/organizations/:id/documents` upload/list routes and migration 011. These are business-organization verification documents, not Sports Transfer negotiation or player-identity documents.
- [x] Upload and metadata-list operations require an authenticated organization owner/admin; ordinary organization members are denied. The database-backed HTTP integration test covers owner/admin allow, member deny, and transaction rollback when the audit insert fails.
- [x] Upload validation restricts names, declared MIME types, base64 input size, decoded file size (5 MiB), and document count (1–4); document bytes are not returned by the list endpoint.
- [x] No API read/download route for `organization_documents.file_data` or reviewer document-review route was found in the reviewed API controller/search results. This is a document workflow completeness gap; no new retrieval/review route was invented during a security audit.
- [ ] Before adding any document retrieval/review workflow, verify file signatures rather than trusting declared MIME type, enforce safe download headers/content disposition, authorize reviewers explicitly, audit every read/review, and test cross-organization denial.
- [x] No dedicated Sports Transfer document, negotiation-room, offer, or transaction-document route was found in the reviewed Sports Transfer controller. The current Sports Transfer API remains profiles, consents, organizations/memberships, mandates, quotes, and private opportunity drafts/listing.
- [x] No production data or services changed.
- [ ] Continue repository-wide review of any frontend document access assumptions and other controllers that may handle sports-related records before closing the authorization audit.


## 30. Document authorization schema verification and frontend recovery review (2026-11-19)

- [x] Verified the legacy `organization_members` schema in migration 001: it contains organization ID, user ID, member role, and creation timestamp only. It does not have membership status, start, or expiry columns. The earlier Sports Transfer date-window predicates apply to the separate `sports_org_memberships` table and must not be copied onto this legacy table.
- [x] Rejected the initial hypothesis that legacy document routes had a date-window bypass. The temporary attempted predicate/test edits were reverted immediately after schema verification; final source retains the existing schema-compatible owner/admin role check. No migration was added.
- [x] Confirmed the frontend has an organization-document loading/retry path and a Playwright recovery test for transient document API failures in `apps/web/e2e/contract-lifecycle.spec.ts`.
- [x] Confirmed the current UI integration exercises document metadata loading and retry; it does not establish file download/review capability. No client call for retrieving `file_data` was found in the reviewed search results.
- [ ] Extend the document integration tests with cross-organization owner/admin denial and upload input edge cases; do not add date-window cases to the legacy membership schema.
- [ ] Continue reviewing organization moderation/reviewer routes and cross-controller sports-related access before closing the broader audit.
- [x] No production data, services, or deployments were changed.


## 31. Cross-organization document isolation and organization moderation review (2026-11-19)

- [x] Traced both document routes in `OrganizationsController`: listing and upload first require a membership row matching the exact target organization ID and authenticated user ID, then require owner/admin role. The document list query is additionally constrained by the same target organization ID. No cross-organization data exposure was found in these paths.
- [x] Extended `apps/api/scripts/test-organization-documents.js` with a second unrelated organization and regression assertions that an owner/admin from organization A receives 403 when listing or uploading documents for organization B. This is a source-level test addition; it has not yet been executed against PostgreSQL.
- [x] Reviewed `ModerationController`: organization queue and review endpoints require the dedicated `TRADEMATE_REVIEW_API_KEY` via constant-time comparison; organization decisions are limited to pending records and transactionally update organization status, review record, pending document review statuses, and audit event.
- [x] Identified a workflow completeness gap: moderation queue returns organization identity/contact metadata but not document metadata or bytes. The moderation decision updates all pending documents for that organization, but no API route was found to retrieve the uploaded `file_data` for actual content inspection. Do not treat this as evidence that a reviewer has examined the documents.
- [x] Repository search found `file_data` only in the migration definition and upload insert path; no API download/read path was found. Sports Transfer offer/negotiation/document endpoints were also not found in the reviewed controller/search scope.
- [ ] Product/security decision required before building reviewer access: define reviewer identity and least-privilege document read scope, safe streaming/download headers, file-signature validation, read-access audit events, retention/deletion, and cross-organization denial tests. Do not expose document bytes through the existing organization member list endpoint or public listing moderation.
- [ ] Run the updated PostgreSQL-backed organization-document integration test in CI and inspect the result before marking cross-organization isolation runtime-verified.
- [x] No production data, services, or deployments were changed.


## 32. Organization membership lifecycle, Sports Transfer manager boundaries, and reviewer-route audit (2026-11-19)

- [x] Searched all API mutations of the legacy `organization_members` table. The only insert in the reviewed API module creates the initial owner membership alongside organization creation; no invite, role-change, removal, or reactivation route was found for this legacy organization model. This is an absent lifecycle capability, not evidence of an exploitable membership-change endpoint.
- [x] Re-reviewed all `SportsTransferOrganizationsController` membership operations. Member listing and invitation require an active owner/admin membership with valid `starts_at`/`expires_at` bounds. Invitation expiry is constrained to the next 30 days; invitation acceptance is restricted to the invited user and an unexpired invitation.
- [x] Confirmed the invitation schema excludes `owner`; admins cannot invite another admin. Revocation rejects owner removal and prevents an admin from revoking another admin. Revocation and invitation changes write audit events transactionally.
- [x] Confirmed `GET /sports-transfer/organizations/mine` is a self-membership listing, not an authorization grant. It currently returns historical/revoked or out-of-window membership rows as well as active rows; downstream manager authorization separately enforces active status and date windows. Consider filtering or explicitly labelling inactive rows in the UI to avoid stale membership presentation.
- [x] Rechecked every route in `ModerationController`: organization queue, organization review, listing queue, and listing review each invoke the shared `TRADEMATE_REVIEW_API_KEY` authorization check.
- [x] Extended the reviewer-route search to `CommunityFeedController`: report queue, report decision, and announcement publication each invoke its `reviewKey()` guard, which uses the same configured key, constant-time comparison, and reviewer key ID. No unguarded feed reviewer route was found in the controller.
- [ ] The shared review key remains a service-level identity rather than named staff accounts with per-reviewer roles, revocation, or separation of duties; retain the documented product/security decision before expanding sensitive reviewer workflows.
- [ ] No changes to source code were required by this pass. No runtime tests were run as part of this source review; existing test/CI evidence remains scoped to the commits and runs documented above.
- [x] No production data, services, deployments, or infrastructure were changed.


## 33. Sports Transfer permission-scope enforcement review (2026-11-19)

- [x] Compared membership scope values in the API schema and migration: `workspace`, `recruitment`, `negotiation`, `documents`, `signing`, and `read_only`.
- [x] Confirmed opportunity creation and organization opportunity listing explicitly require active, in-window memberships with `workspace` or `recruitment` scope, in addition to permitted roles.
- [x] Found that `SportsTransferOrganizationsController.managerRole()` checks active status, start/expiry dates, and `owner`/`admin` role, but does not inspect `permission_scope`. This helper gates member listing, invitations, and membership revocation. Consequently a narrow-scope or `read_only` owner/admin membership currently passes these management checks.
- [ ] Treat this as a scope-enforcement inconsistency requiring a product/security decision, not yet a confirmed privilege vulnerability: the technical foundation describes membership role and permission scope as distinct fields but does not define a complete permission matrix for management actions. Define which scope grants member administration before changing the helper or existing memberships.
- [ ] Add database-backed tests covering owner/admin memberships with `read_only`, `documents`, `recruitment`, and `workspace` scopes once the authorization matrix is approved.
- [x] No source behavior changed in this pass. No runtime tests were run. No production data, services, deployments, or infrastructure were changed.


## 34. Sports Transfer player-consent lifecycle review (2026-11-19)

- [x] Reviewed player-profile ownership checks for consent listing, granting, and revocation. All three operations require the authenticated user to own the referenced profile; revocation additionally updates only a currently granted, not-yet-revoked consent.
- [x] Consent grants require exactly one recipient (user or sporting organization), an existing active user when targeting a person, an existing organization when targeting an organization, a supported purpose, a strictly shaped scope object, and an expiry within 12 months. Grant/revoke operations are audited transactionally.
- [x] A player can grant consent to an existing sporting organization without being a member of that organization. This is consistent with recipient-directed consent, not an authorization bypass by itself; no API route was found that consumes these consent rows to grant access.
- [ ] Consent enforcement remains incomplete at the API surface reviewed: no recipient-side endpoint was found that demonstrates purpose, recipient identity, expiry, revocation, and territory/competition scope being enforced before access to private profile or documents. Do not expose private data based solely on the existence of a consent row; any future consumer must enforce every applicable field and have recipient authentication.
- [ ] No source behavior changed in this pass. No runtime tests were run. No production data, services, deployments, or infrastructure were changed.


## 35. Sports Transfer mandate-to-consent lifecycle and recipient access review (2026-11-19)

- [x] Traced all API references to `sports_player_consents`, `sports_profiles`, and `sports_representative_mandates` in the API module. The only current consent consumer found is mandate creation; no recipient-side private-profile/document read endpoint was found that authorizes access from consent or mandate records.
- [x] Confirmed mandate creation requires a currently granted, unexpired `representative_access` consent from the profile owner to the exact representative user or organization. It checks requested territory and competition values against non-empty corresponding consent arrays.
- [x] Identified a scope-semantics ambiguity with concrete enforcement impact: when a consent scope omits `territoryCodes` or `competitionIds`, or supplies an empty array, mandate creation treats that dimension as unrestricted because it only rejects out-of-scope values when the allowed array has entries. The schema permits both fields to be omitted and permits empty arrays. This may be intentional “unrestricted” semantics, but it is not explicit in the API contract; do not silently assume empty means deny-all or unrestricted.
- [x] Confirmed the mandate expiry is validated independently of the selected consent expiry. A mandate may therefore be created with an expiry later than the consent that enabled its creation, provided both are individually valid when created.
- [x] Confirmed consent revocation updates only the consent row. It does not update or revoke any mandate. The player has a separate mandate-revocation endpoint, and that endpoint does notify the representative. Acceptance checks mandate status and time bounds but does not re-check the originating consent.
- [ ] Product/security decision required: define whether representative-access consent is only a one-time prerequisite for creating a separately binding mandate, or whether it must remain valid throughout the mandate lifecycle. If it must remain valid, bind the mandate to the consent ID, cap mandate expiry at consent expiry, and revoke/suspend pending or active mandates when consent is revoked; add DB-backed tests for each lifecycle transition. If the mandate is the independent authorization after creation, make that distinction explicit in API/UI wording and audit trail.
- [ ] Define scope semantics for omitted and empty territory/competition arrays. Add tests for omitted, empty, partial, and broader-than-consent scopes; do not change authorization behavior until the intended semantics are approved.
- [x] Reviewed mandate listing: player-side list is owner-scoped; representative-side list returns only mandates addressed to that user or to an organization where the user has active, in-window owner/admin membership. The representative list exposes player display name and sport with mandate metadata, not biography or private profile fields.
- [x] Reviewed mandate acceptance/rejection/revocation: acceptance and rejection require the exact named representative or active organization owner/admin; player revocation is owner-scoped and audited. Acceptance explicitly leaves mandate inactive pending separate TradeMate verification.
- [x] No recipient-side API route currently consumes mandate permissions to expose profile or document content. Do not add such a route without checking mandate status, acceptance, verification, start/expiry, representative identity/membership, permitted action, territory, competition, and revocation.
- [x] No source behavior changed. No runtime tests were run in this source-review pass. No production data, services, deployments, or infrastructure were changed.


## 36. Legacy marketplace enquiry and contract authorization consistency review (2026-11-19)

- [x] Reviewed enquiry participant authorization. `authorizedEnquiry()` allows the buyer or any user with a row in legacy `organization_members` for the seller organization to read the enquiry and messages. Reply uses the same participant helper, then rejects closed/reported enquiries and rechecks status under a row lock.
- [x] Reviewed contract actions. Contract proposal response and seller-side completion confirmation explicitly require legacy organization membership role `owner` or `admin`; buyer-side cancellation is restricted to the buyer. Contract detail/messages use the shared `authorizedContract()` helper.
- [x] This establishes a concrete policy inconsistency: ordinary organization members can access and reply to buyer enquiries, while only owner/admin can accept/reject contracts or confirm seller completion. The legacy membership model has no date-window or permission-scope columns, so Sports Transfer membership rules must not be applied to it.
- [ ] Product decision required: confirm whether every legacy organization member is intentionally allowed to see and respond to commercial enquiries. If yes, document this as a deliberate distinction between enquiry collaboration and contract authority, and ensure the UI explains it. If no, introduce a defined enquiry permission/role rule and add DB-backed HTTP tests for member versus owner/admin access to enquiry read/reply, contract read/respond, and completion confirmation.
- [x] The inspected contract queries use buyer identity or seller-organization membership predicates; no cross-organization contract access path was identified in this source pass.
- [x] No source behavior changed. No runtime tests were run in this source-review pass. No production data, services, deployments, or infrastructure were changed.

## 37. Public profile visibility and community-feed attachment content review (2026-11-19)

- [x] Reviewed `GET /profiles/:id`: it requires any active signed-in user, then returns the target user's bio, social handles, website, profile and cover image data, highlights, and public engagement counts. The route does not consult a per-profile visibility setting or per-field audience setting.
- [x] Reviewed `PATCH /profiles/me`: updates only the authenticated user's profile and validates field lengths, HTTPS website URLs, base64 image data URLs, and highlight shape/size. The mutation and audit event are transactional.
- [ ] Product/privacy decision required: confirm whether all profile fields and image/highlight data are intentionally visible to every authenticated user. If so, document this as the public-profile contract and provide clear UI disclosure. If not, add explicit profile/field visibility rules and DB-backed cross-account tests before exposing private profile fields. This source review does not establish an unauthorized cross-account access vulnerability because the route is explicitly the public-profile read surface.
- [x] Reviewed public feed attachment reads: the feed list exposes attachment metadata for published posts, and the attachment route is unauthenticated but constrained to an attachment belonging to the specified published post. The response sets the stored content type, `X-Content-Type-Options: nosniff`, a sanitized inline filename, and public one-hour caching. This is consistent with a public-feed attachment model.
- [x] Upload validation restricts declared MIME types to an allowlist, validates canonical base64, enforces a 5 MiB per-file limit and a maximum of four attachments, and checks that a data URL's declared MIME matches the separate client-supplied MIME field.
- [ ] Verified content-validation gap: the feed upload path does not inspect file signatures or decode/re-encode images; it trusts the client-declared MIME after syntactic validation. A caller can therefore submit bytes that do not match the claimed allowed type. The response's `nosniff` header is a useful mitigation but does not prove content/type correspondence or safe handling by every client. Add magic-byte/container validation (and image decoding/re-encoding where appropriate), tests for mismatched and malformed payloads, and explicit download/inline policy before treating uploaded content as trusted.
- [ ] No source behavior changed. No runtime tests were run in this source-review pass. No production data, services, deployments, or infrastructure were changed.

## 38. Preferences, notifications and customer-support account isolation review (2026-11-19)

- [x] Reviewed preferences read/update: both routes require an active authenticated session and select/update only the row keyed by the authenticated `user_id`. Updates use a strict key/value allowlist and merge only supplied keys; the preference write and audit event are transactional.
- [x] Reviewed notification list/read mutations: list, mark-one-read and mark-all-read all require an active authenticated session. Every query is scoped by the authenticated `user_id`; the mark-one route returns not-found for another user's notification rather than disclosing its existence.
- [x] Reviewed support ticket list, create, message read/reply and feedback list/submit. Reads and replies constrain ticket access by both ticket ID and authenticated owner ID. Replies lock the owned ticket row, reject resolved/closed tickets, and commit the message, status update and audit event together. Ticket creation commits the initial message and audit event with the ticket. Feedback reads/submissions are scoped to the authenticated user and submission is audited transactionally.
- [x] No cross-user ticket, notification, preference or feedback access path was identified in these controller methods. No unauthenticated support write route was found.
- [ ] Operational follow-up: the reviewed customer-facing controller contains no staff support-ticket queue, staff reply, assignment, or resolution endpoint. Confirm whether support operations are handled by a separate trusted system; otherwise the in-app ticket workflow currently supports user submission and reply but not staff handling through this API. This is a workflow-completeness question, not an authorization bypass.
- [x] No source behavior changed. No runtime tests were run in this source-review pass. No production data, services, deployments, or infrastructure were changed.
