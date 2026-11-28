# Integration API key design

The service-side primitive issues cryptographically random integration keys with the `vfy_live_` prefix. The plaintext is returned to the caller once; the caller must copy it into their own secret manager. The service persists only a SHA-256 verifier and a short display prefix.

The primitive uses Node's cryptographic random generator and constant-time comparison. It does not persist keys, create tenants, issue entitlements, or expose an HTTP onboarding endpoint. Those operations require a reviewed persistence model, tenant ownership model, rotation/revocation semantics, audit trail and rate limiting.

Never store an integration key in `.verificationrc.json`, source control, logs, analytics or error messages. A local CLI product selection is not proof of entitlement.
