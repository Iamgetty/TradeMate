# TradeMate Secure Software Development Framework (SSDF) Policy

**Status:** Adopted as the engineering security baseline  
**Framework:** NIST SP 800-218, Secure Software Development Framework (SSDF)  
**Applies to:** TradeMate web application, API, database migrations, deployment configuration, background workers, integrations and operational tooling  
**Effective date:** 2026-11-01  
**Review cadence:** At least quarterly and after a material security incident or major architecture change

This policy establishes the minimum secure-development process for TradeMate. It is a working control document: implementation evidence and release records must be maintained alongside it. A policy statement alone does not prove that a control is operating.

## 1. Accountability

The following responsibilities must be assigned to named people before a production release that introduces high-risk functionality:

- **Product/security owner:** approves security requirements, risk acceptance, scope changes and release exceptions.
- **Engineering owner:** maintains secure architecture, code review, dependency hygiene, tests and remediation.
- **Operations owner:** controls production access, secrets, backups, monitoring, incident response and recovery.
- **Privacy/compliance owner or qualified adviser:** approves personal-data processing, retention, jurisdictional obligations and regulated-provider arrangements.
- **Independent assessor:** performs security testing before high-risk financial functionality is enabled.

One person may temporarily hold more than one responsibility, but the assignment and any conflicts must be recorded. High-risk changes require a second-person review; the author cannot approve their own exception.

## 2. Prepare the organization (NIST SSDF PO)

### PO.1 — Define security requirements
- Maintain security and privacy requirements for authentication, identity verification, organization membership, marketplace contracts, moderation, notifications and any future financial workflows.
- Record applicable jurisdictions, data categories, retention periods, legal bases and third-party processing responsibilities before collecting new sensitive data.
- Treat escrow, custody, payment initiation, crypto transfer and sanctions decisions as separately gated capabilities, not ordinary feature work.

### PO.2 — Implement roles and responsibilities
- Assign the responsibilities in Section 1 for each release.
- Require security review for changes to authentication, authorization, personal data, database access, cryptography, financial state or external integrations.

### PO.3 — Implement supporting toolchains
- Pin and review CI actions and build tools.
- Use automated type checking, tests, SAST, dependency/SCA scanning and secret scanning.
- Keep production secrets out of source code, build logs, artifacts and client-side bundles.

### PO.4 — Define security criteria
- Every change must have acceptance criteria, test evidence and a rollback or recovery plan proportionate to risk.
- Critical or actively exploited vulnerabilities block release.
- High-severity findings block release unless a documented, time-limited exception is approved by the security owner and accompanied by compensating controls.
- Exceptions must identify the affected asset, exposure, owner, mitigation, expiry date and remediation ticket.

## 3. Protect software (NIST SSDF PS)

- Restrict repository, deployment and production access to named accounts with MFA.
- Use least-privilege credentials; separate migration, runtime and read-only/background database roles.
- Store secrets in the deployment secret manager. Rotate exposed credentials immediately and record the rotation.
- Protect branches and require CI checks and review before merge.
- Review third-party packages, GitHub Actions, containers and external services before adoption.
- Maintain an inventory of services, data stores, external processors and production secrets (never record secret values in the inventory).

## 4. Produce well-secured software (NIST SSDF PW)

- Use strict TypeScript in API code and explicit runtime validation for every untrusted request boundary.
- Validate request bodies, query strings, path parameters, headers and environment configuration with schemas. Reject unknown fields where practical.
- Enforce authentication and object-level authorization server-side; never trust client-supplied user or organization identifiers.
- Use parameterized SQL. Review dynamic SQL, file handling, upload limits, URL fetching and serialization for injection and resource-exhaustion risks.
- Apply database constraints and transactional state transitions to protect business invariants.
- Use approved cryptographic libraries and managed keys; never design custom cryptography.
- Add unit, integration, migration, authorization and failure-path tests for security-sensitive behaviour.
- Keep development, test and production data isolated. Do not copy production personal data into test environments without approved safeguards.

## 5. Respond to vulnerabilities (NIST SSDF RV)

- Provide a route for internal and external vulnerability reports and acknowledge reports promptly.
- Triage findings by exploitability, impact, exposure and affected data or business process.
- Patch or mitigate confirmed vulnerabilities, add regression tests and verify the fix.
- Track dependency advisories and secret exposure continuously.
- Preserve incident evidence, notify affected parties and regulators when required by applicable law, and conduct a post-incident review.

## 6. Mandatory pull-request evidence

Every pull request must state:
1. What changed and which trust boundaries or data classes are affected.
2. Whether authentication, authorization, personal data, cryptography, financial state or third-party integrations changed.
3. Validation and authorization tests added or updated.
4. CI results for build, tests, migrations, SAST, SCA and secret scanning.
5. Deployment, migration and rollback considerations.
6. Any security exception, its approver and expiry.

Changes affecting authentication, access control, RLS, encryption, payments, escrow, KYC/AML or wallet screening require an explicit security review before merge.

## 7. Release gates

A release is blocked when:
- required CI jobs fail or are skipped;
- a migration fails on a clean database or its rollback/recovery plan is absent where rollback is feasible;
- critical/high-risk authorization or data-isolation tests fail;
- a critical or actively exploited vulnerability remains unresolved;
- a secret is committed or exposed;
- a high-risk financial feature lacks approved legal/compliance review, threat model and independent security assessment.

Production verification must record the deployed commit, migration result, smoke-test outcome and rollback owner. A passing CI run does not by itself prove successful production deployment.

## 8. Required evidence register

Maintain evidence in the repository or an access-controlled operational record:

| Evidence | Minimum record |
| --- | --- |
| Security requirements | Feature/risk, owner, jurisdiction and acceptance criteria |
| Architecture and threat models | Data flows, trust boundaries, abuse cases, mitigations and residual risk |
| CI security results | Commit SHA, tool/version, findings, disposition and expiry for exceptions |
| Database isolation | Role grants, RLS policies, pool-isolation test results and migration run |
| External providers | Due diligence, contract, data processing terms, webhook verification and test evidence |
| Release approval | Commit, checks, migration, deployment verification, exceptions and rollback plan |
| Incidents | Timeline, impact, containment, notification decision, remediation and lessons learned |

## 9. Current implementation status

This policy is adopted as the target process. Controls are implemented only when their corresponding code, configuration, test and operational evidence exists. The security roadmap in `docs/roadmap.md` tracks the staged implementation; no item should be marked complete solely because this policy describes it.
