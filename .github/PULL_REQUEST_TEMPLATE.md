## Summary
- 

## Security impact
- [ ] No security-sensitive boundary changed.
- [ ] Authentication or session handling changed.
- [ ] Authorization, ownership or organization isolation changed.
- [ ] Personal or sensitive data changed.
- [ ] Database schema, roles, grants or RLS changed.
- [ ] Cryptography, secrets or key handling changed.
- [ ] Financial, contract, escrow or payment state changed.
- [ ] Third-party provider or webhook integration changed.

## Validation and evidence
- [ ] Request bodies, query parameters and path parameters are validated at the API boundary.
- [ ] Unknown or unsupported input is rejected where applicable.
- [ ] Server-side authentication and object-level authorization are tested.
- [ ] Negative, boundary and failure-path tests are included.
- [ ] Database migrations pass on a clean PostgreSQL database.
- [ ] RLS and connection-pool isolation tests pass (when applicable).
- [ ] CI build, test, SAST, SCA and secret-scanning checks pass.
- [ ] No secrets, tokens, private keys or production personal data are committed.

## Deployment and recovery
- [ ] Environment variables and provider configuration are documented without secret values.
- [ ] Migration and deployment order is documented.
- [ ] Rollback or forward-recovery plan is documented.
- [ ] Production verification and smoke tests are identified.

## Risk acceptance (if needed)
- Finding / risk:
- Compensating controls:
- Approver:
- Expiry date:
- Remediation tracking issue:

> Security-sensitive changes require review by someone other than the author. Authentication, authorization, RLS, encryption, KYC/AML, wallet screening and financial functionality must not be released without the required security and compliance approvals.
