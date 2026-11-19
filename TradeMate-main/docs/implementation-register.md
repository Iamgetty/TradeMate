# TradeMate implementation register

**Canonical cross-stack status ledger.** Updated: 2026-11-19 (PR #219 head `62eae8e975f1ab76a5fbc35ba1761c1f222ec0c7`; Node.js runtime alignment CI pending)  
**Branch baseline:** `fix/audit-remediation-2026-11-18`  
**Rule:** no domain is complete merely because its first component exists. Repository implementation, CI verification, staging validation and production acceptance are tracked separately.

## Status legend

- ☐ **Not implemented:** no qualifying implementation evidence recorded.
- ◐ **Partial:** a foundation or subset exists; material scope or acceptance gates remain.
- ✓ **Implemented (repository):** implementation is evidenced in the repository and applicable automated checks pass.
- ★ **Production accepted:** deployed version and production acceptance evidence are recorded.
- ? **Unverified:** evidence is missing, stale, or insufficient. This is not a pass.

## Domain register

| Domain | Initial status | What must be evidenced before the domain can be called complete |
|---|---|---|
| 1. Frontend, web UX and design system | ◐ Partial | Product-wide feature inventory, accessibility (including WCAG target), browser/device coverage, performance budgets, visual and end-to-end tests, production UX telemetry |
| 2. Backend, APIs and distributed systems | ◐ Partial | API/service inventory, authorization and contract coverage, resilience behavior, capacity/latency tests, operational ownership and production SLO evidence |
| 3. Databases, storage and data engineering | ◐ Partial | Schema/data inventory, safe authorization model, migration tests, role/grant and RLS adversarial tests, backup restore and data-equivalence evidence, operational monitoring |
| 4. Trading, market data, brokers and MT5 | ◐ Partial | Feed provenance/freshness and failover tests, symbol/session correctness, broker contract tests, order lifecycle, risk controls, reconciliation and explicit live-trading acceptance |
| 5. AI, ML and quantitative intelligence | ☐ Not implemented / unverified | Governed data/model lifecycle, reproducible evaluation, out-of-sample validation, drift/robustness monitoring, human oversight and approved risk controls |
| 6. Cloud, infrastructure and networking | ◐ Partial | Full deployed-service inventory, infrastructure-as-code coverage, network and identity review, capacity, regional resilience, cost controls and verified recovery |
| 7. Mobile and cross-platform | ☐ Not implemented / unverified | Product decision, supported platform matrix, secure storage/session design, accessibility, device automation, crash/startup metrics and release pipeline |
| 8. Integrations and interoperability | ◐ Partial | Complete vendor/API inventory, scoped credentials, contract/webhook/replay tests, failure handling, vendor risk review and tested exit/substitution plans |
| 9. DevOps, CI/CD and platform engineering | ◐ Partial | Workflow inventory, reproducible builds, artifact provenance, protected release gates, environment parity, rollback evidence and controlled production release |
| 10. Testing, quality and performance | ◐ Partial | Risk-based test matrix, stable CI results, critical financial/security invariants, accessibility/load/soak/recovery coverage and measurable regression thresholds |
| 11. Observability, analytics and BI | ◐ Partial | Service-wide structured logs, metrics/traces, actionable alerts, on-call/runbooks, privacy controls, SLO dashboards and verified alert response |
| 12. Security, identity and privacy | ◐ Partial | Threat model, authorization/RLS evidence, secure SDLC, endpoint/edge controls, incident response, independent testing and applicable assurance evidence |
| 13. Reliability, resilience and disaster recovery | ◐ Partial | Criticality tiers, SLOs, RTO/RPO, tested backup/restore, failover and recovery exercises, incident procedures and evidence |
| 14. Compliance, localization and global readiness | ☐ Not implemented / unverified | Jurisdiction/product matrix, qualified legal review, privacy/data residency controls, localization, accessibility and independent compliance evidence |
| 15. Developer experience and architecture governance | ◐ Partial | Ownership/catalogue, ADRs, coding/review standards, dependency lifecycle, maintainability measures, architecture documentation and upgrade plans |

**Important:** These are conservative initial domain-level assessments based on the currently available project audit context. They are not individual feature-level checkmarks and do not constitute production acceptance. Revalidate each row against the exact current branch and deployed environment before upgrading its status.

## Current engineering increment (CI verified; production acceptance not implied)

| Item | Evidence | Status |
|---|---|---|
| RLS pilot refuses generic `DATABASE_URL` and requires a dedicated test URL | Commit `2ea5d8ce467e7fb6996de186c9af6dec8efd85f0`; `TradeMate-main/apps/api/scripts/test-rls-pilot.js`; database integration job passed in run [44482623584](https://github.com/Iamgetty/TradeMate/actions/runs/44482623584) on descendant PR head `e4d3fea0` | ✓ Repository implementation and CI execution verified; not production acceptance |
| CI supplies dedicated disposable RLS test database URL | Commit `3b7072f75f388b80967c122d6eec5736cc485709`; `.github/workflows/ci.yml`; database integration job passed in run [44482623584](https://github.com/Iamgetty/TradeMate/actions/runs/44482623584) on descendant PR head `e4d3fea0` | ✓ Repository implementation and CI execution verified; not production acceptance |
| Regression tests for RLS pilot connection guard | Current branch includes query-parameter/fragment rejection tests and invokes `node --test test/test-rls-pilot-safety.test.cjs` in the database CI job; full database job passed in run [44482623584](https://github.com/Iamgetty/TradeMate/actions/runs/44482623584), commit `e4d3fea0e79b5124b1d4d274665539da95f93750` | ✓ Repository implementation and CI execution verified; not production acceptance |
| Full CI validation on latest code-bearing PR head | TradeMate CI run [44601661238](https://github.com/Iamgetty/TradeMate/actions/runs/44601661238) tested exact PR head `fc094efa2fe69d15fdfc4fa647d4bccafa651f28`; all 8 primary jobs passed: web build/runtime, database migration integration, isolated Cloudflare Workers build/runtime, API TypeScript build and security validation, exchange-feed/MT5 tests, browser app-shell/live API acceptance, AWS API/exchange-feed container builds, and SAST/SCA/secret scanning. The additional non-destructive vinext compatibility scan also passed. Separate Cloudflare compatibility run [44601660723](https://github.com/Iamgetty/TradeMate/actions/runs/44601660723) passed. The API security validation process exited normally; the prior 90-second hang is no longer present on this head. | ✓ CI verified on exact code-bearing head; no production acceptance claim |
| Trusted RLS identity architecture | Proposed requirements and adversarial acceptance gates documented in `docs/security/database-rls-trusted-context.md` (commit `5ce86414908b7f50e472030851686dc8a6e12cf8`) | ◐ Design proposal only; no implementation or CI validation yet |
| Production RLS enablement | Not performed; live audit found RLS disabled on all 50 application tables with zero policies | ☐ Not implemented; intentionally blocked pending safe design and adversarial tests |
| Runtime/migration credential isolation | Fresh source review on 19 Nov 2026 confirms `src/main.ts` calls `validateEnvironment()` and `src/environment.ts` requires both `DATABASE_URL` and `MIGRATION_DATABASE_URL` in production; the API therefore explicitly depends on the elevated secret as well as inheriting it from the Render service. `scripts/migrate.js` correctly fails closed without the dedicated production migration URL and has no runtime-role fallback. `render.yaml` still injects both credentials into `trademate-api` and runs migrations in its startup sequence. `.github/workflows/database-migrations.yml` still has an automatic push trigger, runtime-credential fallback and no declared protected GitHub Environment. Reviewed paths contain no dedicated environment-validation test file. Detailed implementation review and safe sequence: `docs/security/migration-execution-isolation.md` (commit `1c9d2468a54c22efc992420f9d7b61f6806ded95`). | ◐ Verified two execution-path gaps plus API bootstrap dependency. No safe isolated production path selected or implemented. Do not make a code-only environment-validation change, move to pre-deploy, or use an API-based one-off job as a claimed isolation fix. Require platform-owner verification of a migration-only runner, protected approvals, safe DB connectivity, immutable revision matching and release ordering before coordinated implementation. No production change made |
| Market-data provider authority, freshness and sequence integrity | CoinGecko remains secondary metadata only; exchange-feed owns displayed spot price. Metadata refresh coalesces requests, validates responses, protects eligible-page context and fails closed. Server-side order-book expiry marks missing or older-than-10-second books stale; browser clients exclude stale books from depth and catalogue quotes. Feed-health shape mismatch and numeric depth aggregation corrected. Bybit standard order-book deltas use consecutive `u` update IDs; duplicates/older IDs are ignored, gaps and reset markers invalidate the book and reconnect. Coinbase classic Exchange `level2` uses its documented delivery guarantee without importing Advanced Trade `sequence_num`; sequence status remains `unsupported`. Binance partial-depth stream remains `unsupported` pending a REST snapshot/diff-depth bridge. Helper tests cover sequence decisions and malformed IDs; current integration tests exercise the Bybit upstream snapshot/delta/duplicate/gap/reconnect lifecycle using injected fake sockets; this validates handler behavior but is not a live venue conformance or production soak test. Exact PR head `ac0d45b637413d0d9ef103e72e983d1666c821b6` passed TradeMate CI run [1749](https://github.com/Iamgetty/TradeMate/actions/runs/44579852420) (8 jobs) and Cloudflare compatibility run [562](https://github.com/Iamgetty/TradeMate/actions/runs/44579852422). | ◐ Partial repository implementation and CI verified; venue lifecycle fixtures, Binance bridge, staging soak and production acceptance remain outstanding |
| Migration execution isolation architecture | Proposed ADR `docs/security/migration-execution-isolation.md` documents Render service inheritance, one-off job base-service inheritance, the current free-plan pre-deploy limitation, the existing GitHub workflow fallback/trigger, options, release-ordering requirements and acceptance gates. | ◐ Design proposal only; no option selected, no production secrets/configuration changed, no migration or deployment run |

## Current RLS test-harness hardening increment (repository change; CI verified on code-bearing head)

- Rejects URL query parameters and fragments so alternate connection parameters cannot silently override the validated loopback target.
- Adds two regression cases for those rejected URL forms.
- Adds an explicit Node test-runner step to CI before the RLS pilot database script; previously the standalone test file was not invoked by the workflow.
- No database schema, production role, RLS policy or production setting is changed by this increment.
- CI evidence above is for code-bearing head `e4d3fea0`; subsequent commits `8a703d95`, `3fa94713` and `5ce86414` changed documentation only. No CI run has yet been recorded for the latest documentation-only branch head.
- **Security limitation identified during review:** `app.user_id` is a caller-settable PostgreSQL custom setting for the runtime role. The pilot verifies policy behavior when the context is correctly populated; it does not prove protection against arbitrary SQL executed as `trademate_app` or a compromised application session. Session-derived context in `database-context.ts` is application-side groundwork, not an unforgeable database identity assertion. Do not describe this pilot as a complete authorization boundary. An independent trusted-context design and adversarial impersonation test are still required before production RLS approval.
- **Deployment credential-isolation limitation identified during review:** `render.yaml` gives the API service `MIGRATION_DATABASE_URL` and executes migrations in that same service's `startCommand`. Because the API process inherits the service environment, the elevated migration credential remains available to the long-running API process. A distinct URL is not sufficient isolation while both commands share the same service environment. Separate, gated migration execution and a deployment-order/rollback design are required before claiming runtime/migrator separation.


| Node.js runtime lifecycle alignment | Node.js 20 was still used by six CI setup steps even though the Node.js project lists v20 as EOL; API and exchange-feed Docker images used Node 22; the Render Blueprint had no explicit Node version. PR #219 now pins Node.js 24.22.1 in `TradeMate-main/.node-version`, package `engines` constraints (`>=24.22.1 <25`) for API/web/exchange-feed, all active root CI setup steps, Cloudflare compatibility and database migration workflows, both Docker images (`node:24-bookworm-slim`), and all three Render services via `NODE_VERSION`. Exact head `62eae8e975f1ab76a5fbc35ba1761c1f222ec0c7`; TradeMate CI run [44607161777](https://github.com/Iamgetty/TradeMate/actions/runs/44607161777) and Cloudflare compatibility run [44607161926](https://github.com/Iamgetty/TradeMate/actions/runs/44607161926) were pending at last check. | ◐ Repository configuration aligned; exact-head CI and deployed runtime verification still required. Render Blueprint changes have not been applied to production. |

## Dependency reproducibility gate (rechecked 19 Nov 2026)

- The tracked repository tree at PR #219 head `fc094efa2fe69d15fdfc4fa647d4bccafa651f28` contains no npm lockfile (`package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml` or `yarn.lock`) for `TradeMate-main/apps/api`, `TradeMate-main/apps/web` or `TradeMate-main/exchange-feed`.
- The three package manifests declare semver ranges. The current CI, database, web, API, exchange-feed and Cloudflare compatibility workflows install with `npm install --no-audit --no-fund`; they do not enforce a committed dependency graph with `npm ci`.
- Therefore current green CI proves those workflows succeeded against the dependency graph resolved during that run, not that a future install will reproduce the same graph.
- Next implementation task: generate each lockfile from its own package manifest using a supported npm version and registry resolution, inspect the resolved tree for security/compatibility, then verify clean `npm ci` installs and all affected tests/builds. Do not copy the stale API lockfile from PR #213 or hand-author lockfile contents. This repository review did not generate or commit lockfiles because a trustworthy npm resolver/install run was not available in this GitHub-only editing session.
- Status: ◐ dependency management partially implemented; lockfile reproducibility and frozen-install CI remain outstanding. No dependency versions or production environments changed in this review.

## Update template

For each material feature, add a row with:

| Field | Required value |
|---|---|
| Domain / capability | Specific capability, not just a broad stack name |
| Repository evidence | Paths and exact commit SHA |
| CI evidence | Workflow/run link, final status, tested commit |
| Staging evidence | Release/environment and test result, or “not run” |
| Production evidence | Deployed version, acceptance checks, telemetry window and accountable approval, or “not accepted” |
| Remaining gaps | Explicit tests, controls, reliability or operational work still outstanding |
| Owner / next review | Accountable role and review date |

## Acceptance rule

Only use **★ Production accepted** when the exact deployed release has passed the agreed acceptance suite in the intended production environment and the accountable owner has approved the evidence. A green build, source-code presence, a successful deployment operation, a restore exit code, or an unexecuted test is not production acceptance.
