# TradeMate implementation register

**Canonical cross-stack status ledger.** Updated: 2026-11-19 (full CI run 1675 recorded; deployment credential-isolation gap documented)  
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
| Full CI validation on current PR head | TradeMate CI run [1675](https://github.com/Iamgetty/TradeMate/actions/runs/44556153628) tested exact PR head `0b7986368fa5fefbc62deb00c45e7793a652d0ae`; all 8 jobs passed: web build/runtime, database migration integration, isolated Cloudflare Workers build/runtime, API TypeScript build, exchange-feed/MT5 tests, browser app-shell/live API acceptance, AWS API/exchange-feed container builds, and SAST/SCA/secret scanning. Cloudflare compatibility run [487](https://github.com/Iamgetty/TradeMate/actions/runs/44556153615) also passed on the same head. | ✓ CI verified on exact PR head; no production acceptance claim |
| Trusted RLS identity architecture | Proposed requirements and adversarial acceptance gates documented in `docs/security/database-rls-trusted-context.md` (commit `5ce86414908b7f50e472030851686dc8a6e12cf8`) | ◐ Design proposal only; no implementation or CI validation yet |
| Production RLS enablement | Not performed; live audit found RLS disabled on all 50 application tables with zero policies | ☐ Not implemented; intentionally blocked pending safe design and adversarial tests |
| Runtime/migration credential isolation | `render.yaml` currently places `MIGRATION_DATABASE_URL` on the `trademate-api` service and its `startCommand` runs `npm run db:migrate && npm run start:prod`; the API process therefore inherits the migration credential. This conflicts with the intended least-privilege separation even though `migrate.js` requires the distinct variable in production. | ◐ Configuration gap identified; do not claim migration credentials are isolated from the long-running API. Requires a separately executed, explicitly gated migration task before removing the startup migration step. No production change made |

## Current RLS test-harness hardening increment (repository change; CI verified on code-bearing head)

- Rejects URL query parameters and fragments so alternate connection parameters cannot silently override the validated loopback target.
- Adds two regression cases for those rejected URL forms.
- Adds an explicit Node test-runner step to CI before the RLS pilot database script; previously the standalone test file was not invoked by the workflow.
- No database schema, production role, RLS policy or production setting is changed by this increment.
- CI evidence above is for code-bearing head `e4d3fea0`; subsequent commits `8a703d95`, `3fa94713` and `5ce86414` changed documentation only. No CI run has yet been recorded for the latest documentation-only branch head.
- **Security limitation identified during review:** `app.user_id` is a caller-settable PostgreSQL custom setting for the runtime role. The pilot verifies policy behavior when the context is correctly populated; it does not prove protection against arbitrary SQL executed as `trademate_app` or a compromised application session. Session-derived context in `database-context.ts` is application-side groundwork, not an unforgeable database identity assertion. Do not describe this pilot as a complete authorization boundary. An independent trusted-context design and adversarial impersonation test are still required before production RLS approval.
- **Deployment credential-isolation limitation identified during review:** `render.yaml` gives the API service `MIGRATION_DATABASE_URL` and executes migrations in that same service's `startCommand`. Because the API process inherits the service environment, the elevated migration credential remains available to the long-running API process. A distinct URL is not sufficient isolation while both commands share the same service environment. Separate, gated migration execution and a deployment-order/rollback design are required before claiming runtime/migrator separation.

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
