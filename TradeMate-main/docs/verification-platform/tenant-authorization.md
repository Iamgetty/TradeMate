# Tenant and product authorization boundary

The authorization service composes three independent server-side records:

1. An active, unexpired integration API key, looked up by a non-secret display prefix and verified against its stored hash.
2. An active tenant that owns the key.
3. An active entitlement whose start and expiry window includes the current time for the requested product.

A local `.verifirerc.json` selection and public catalogue entry never grant access. Missing, invalid, revoked, suspended or expired authorization states return the same generic authorization error.

The implementation depends on repository interfaces. It deliberately does not choose a database or persist records yet. A production adapter must enforce unique key-prefix indexing, transactional key rotation/revocation, tenant isolation, entitlement audit history, and strict access controls. Apply rate limits before calling authorization. The returned tenant context is the only tenant identity downstream request handlers should trust; never accept tenant IDs from caller-controlled request bodies as authority.


## Tenant administrator identity

Tenant administrators are represented by memberships bound to an external identity using the validated OpenID Connect issuer and subject pair. The membership is tenant-scoped and carries an explicit role (`owner` or `admin`) and status. The same external identity may administer more than one tenant; membership lookup must always include the tenant ID.

A future authentication middleware must validate the identity token signature, issuer, audience, expiry and relevant authentication policy before resolving a membership. It must then check membership status and role for the requested operation. Never trust issuer, subject, tenant ID, role or actor ID supplied in an ordinary request body. The identity provider and token-validation implementation have not been selected or connected.

## Tenant provisioning domain service

`tenant-provisioning.ts` provides a persistence-neutral domain operation that creates a tenant, its initial owner membership, explicitly requested product entitlements and a platform-admin audit event in one transaction. Each initial entitlement requires an explicit start timestamp and expiry. The caller must supply a trusted platform-admin context and identity claims already validated by a future authentication layer.

The provisioning request key is hashed before persistence. A request fingerprint binds that key to the owner identity and exact initial entitlement set. Replaying the same request returns the original tenant; reusing the key with changed parameters fails closed. Production adapters must enforce a unique constraint on the request-key hash and roll back the full transaction on any failure.

**Not implemented:** platform-admin authentication, OIDC token validation, HTTP provisioning routes, tenant-admin login/session UX, or a production persistence adapter. A separate authorization primitive now resolves tenant-scoped membership from claims already validated by an upstream identity layer and enforces owner-only operations. It does not validate tokens itself. This domain service is not externally callable until a trusted platform-admin authorization boundary is built.
