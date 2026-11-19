# TradeMate implementation register

**Canonical cross-stack status ledger.** Updated: 2026-11-19  
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

## Current verified engineering increment

| Item | Evidence | Status |
|---|---|---|
| RLS pilot refuses generic `DATABASE_URL` and requires a dedicated test URL | Commit `2ea5d8ce467e7fb6996de186c9af6dec8efd85f0`; `TradeMate-main/apps/api/scripts/test-rls-pilot.js` | ✓ Implemented in repository; CI result pending |
| CI supplies dedicated disposable RLS test database URL | Commit `3b7072f75f388b80967c122d6eec5736cc485709`; `.github/workflows/ci.yml` | ✓ Implemented in repository; CI result pending |
| Regression tests for RLS pilot connection guard | Commit `7a02a33e11c91380be98055b942bb0711adb0529`; `TradeMate-main/apps/api/test/test-rls-pilot-safety.test.cjs` | ✓ Test cases added; execution not yet verified |
| CI validation of the above increment | Workflow run `44481915364` was cancelled before the database job/RLS step completed | ◐ Pending; do not mark passed |
| Production RLS enablement | Not performed; live audit found RLS disabled on all 50 application tables with zero policies | ☐ Not implemented; intentionally blocked pending safe design and adversarial tests |

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
