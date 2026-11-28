# Tenant and product authorization boundary

The authorization service composes three independent server-side records:

1. An active, unexpired integration API key, looked up by a non-secret display prefix and verified against its stored hash.
2. An active tenant that owns the key.
3. An active entitlement whose start and expiry window includes the current time for the requested product.

A local `.verifirerc.json` selection and public catalogue entry never grant access. Missing, invalid, revoked, suspended or expired authorization states return the same generic authorization error.

The implementation depends on repository interfaces. It deliberately does not choose a database or persist records yet. A production adapter must enforce unique key-prefix indexing, transactional key rotation/revocation, tenant isolation, entitlement audit history, and strict access controls. Apply rate limits before calling authorization. The returned tenant context is the only tenant identity downstream request handlers should trust; never accept tenant IDs from caller-controlled request bodies as authority.
