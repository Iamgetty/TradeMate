# Verification Service

This directory is reserved for the independently deployable verification engine. It is deliberately separate from `apps/api` (TradeMate's application API).

The first implementation slice must remain provider-neutral:
- independent process and configuration;
- versioned public API contract;
- tenant-scoped integration authentication;
- health/readiness endpoints;
- typed provider adapter interfaces;
- normalized result types;
- no dependency on TradeMate cookies, users, organizations or database tables.

Do not add live provider integrations, provider credentials, real identity-data persistence, or deployment resources until the relevant product and legal decisions are approved.

See [the architecture baseline](../../docs/verification-platform/architecture.md).
