# VeriFire Service

Standalone, provider-neutral service boundary. It does not depend on TradeMate sessions, users, organizations or database tables.

## Local development

Requires Node.js 24 or later.

```sh
npm install
npm run typecheck
npm test
npm start
```

The service listens on `0.0.0.0:8080` by default. Set `PORT` and `HOST` to override.

## Initial HTTP surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/health/live` | Process liveness |
| GET | `/health/ready` | Readiness, including catalogue availability |
| GET | `/v1/products` | Discover separately selectable products |
| GET | `/v1/products/:product/versions` | Discover releases for one product |

All responses are JSON, include request IDs, and use `Cache-Control: no-store`.

## Scope and security boundary

This first HTTP runtime exposes public catalogue metadata only. The codebase now includes persistence-neutral repository contracts, transactional API-key create/revoke domain services, and authorization/scope primitives, but none are connected to the HTTP server or a production persistence adapter. It does not yet create tenants through an API, authenticate API keys on requests, activate product entitlements, accept identity evidence, execute checks, or call providers. Do not treat catalogue visibility or a local CLI selection as authorization.

The next service layer must add tenant-scoped authentication and server-side entitlement enforcement before any verification request endpoint is exposed. Do not persist raw identity documents, biometrics, government identifiers or provider payloads. Live provider adapters require explicit legal/provider approval.
