# PostgreSQL roles and Row-Level Security design

**Status:** Design baseline only — RLS is not yet enabled.  
**Applies to:** Render PostgreSQL, API connection pool, migration runner and background workers.

RLS must be introduced only after the runtime role, request context and connection-pool behaviour have been tested. The current API issues queries through a shared `pg.Pool` and also opens explicit transactions. Enabling policies before those paths establish transaction-local identity would break legitimate workflows and could create unsafe partial coverage.

## 1. Role separation

| Role | Login | Ownership | RLS bypass | Intended access |
| --- | --- | --- | --- | --- |
| `trademate_migrator` | Yes, deployment only | Owns schema objects and runs migrations | Owner privileges only | DDL and controlled data migrations; never used for web requests |
| `trademate_app` | Yes | No | No | Minimum CRUD privileges required by API; subject to RLS |
| `trademate_worker` | Yes | No | No | Narrow permissions for scheduled/background jobs only |
| `trademate_readonly` | Yes, only if required | No | No | Explicitly approved read-only operational queries |
| Current Render administrator | Existing administrative access | Existing | Administrative | Role bootstrap, grants and emergency maintenance only |

Passwords must be generated and stored in Render environment secrets, never committed. Runtime credentials must not own application tables and must not have `BYPASSRLS`, superuser or migration privileges.

## 2. Connection configuration

The API runtime must use a dedicated `DATABASE_URL` for `trademate_app`. Migrations must use a separate `MIGRATION_DATABASE_URL` for `trademate_migrator`. Background workers must use their own role and connection string.

The Render start command currently runs migrations before starting the API. Before role separation is activated, the migration runner must be changed to prefer `MIGRATION_DATABASE_URL`, while the API pool continues to use `DATABASE_URL`. The migration workflow must continue using its separate administrative migration secret.

No credentials are to be copied into source files, workflow YAML, issue comments or chat messages.

## 3. Request identity context

RLS policies will use transaction-local PostgreSQL settings, not session-wide settings:

- `app.user_id`: authenticated user UUID.
- `app.organization_id`: organization UUID only after membership has been checked for the current request.
- `app.session_token_hash`: optional bootstrap context for resolving the current session without exposing another user's session rows.

The API must establish context with parameterized `set_config(name, value, true)` calls inside the same transaction as the protected query. The final `true` argument makes the setting transaction-local. Never use session-level `SET` or `set_config(..., false)` with a pooled connection: a reused connection could leak one user's context into another request.

The session bootstrap path must resolve the user from a valid, unexpired, unrevoked session before assigning `app.user_id`. Organization context must be derived from a verified membership record, never trusted directly from a request body or query string.

Every query path must be covered, including direct `pool.query`, explicit `pool.connect()` transactions, public routes, account recovery, webhook handlers and scheduled workers. The API must not start with RLS enabled until this inventory and refactor are complete.

RLS is a database backstop against missing application predicates. It does not make a compromised application role safe if arbitrary SQL can be executed as that role; parameterized SQL, least privilege and application authorization remain mandatory.

## 4. Table policy groups

The migration inventory includes the following data classes. Exact policy expressions and table ownership must be verified against the final schema before migration 020 is authored.

### User-private records
- `users` (private account fields), `user_credentials`, `user_sessions`, `user_auth_security`, `auth_login_challenges`, `user_preferences`, `user_profiles`, `user_notifications`, `user_deletion_requests`.
- A user may read or update only their own private record. Credentials and authenticator secrets must never be exposed by general profile reads.
- Public profile fields require a restricted read projection; the private profile row must not become globally readable merely to display public profile cards.

### Organization-scoped records
- `organizations`, `organization_members`, `organization_documents`, organization-owned listings/media, reviews, enquiries/messages/read receipts and contract records/messages.
- Membership and role checks must be enforced for each organization operation. Owners, admins, members and counterparties must receive only the permissions defined by the product workflow.
- Documents and private enquiries/messages are never public.

### Public read with controlled writes
- Published marketplace listings and approved feed posts may be readable according to current product visibility rules.
- Drafts, attachments, reports, comments awaiting moderation and private contract/enquiry details require ownership, counterparty or moderator checks.
- `user_follows` requires controlled visibility and prevents self-follow; private account settings remain private.

### System and moderation records
- `audit_events` is append-only for runtime roles. The app may insert approved events but must not update or delete them.
- `auth_rate_limits` is restricted to authentication/rate-limit operations.
- Support tickets, feedback, moderation reports and review decisions are limited to their owners and authorized support/moderation roles.
- Market reference data may be read-only for the API; writes are reserved for the feed ingestion role.

## 5. Policy and grant rules

- Enable RLS on each sensitive table with explicit policies for SELECT, INSERT, UPDATE and DELETE as needed. Omit a policy when an operation is not permitted.
- Use `FORCE ROW LEVEL SECURITY` where table-owner bypass must not apply to normal data access. The migration owner remains the only controlled schema owner.
- Avoid a blanket `USING (true)` policy on sensitive tables.
- Use explicit grants. RLS does not replace SQL privileges.
- Add database constraints and foreign keys for ownership relationships wherever feasible.
- Keep privileged security-definer functions minimal, schema-qualified, reviewed and executable only by intended roles.

## 6. Required tests before enabling RLS

1. User A cannot read or modify User B's sessions, credentials, preferences, notifications, private profile fields or deletion request.
2. An organization member cannot access another organization's documents, enquiries, contracts or private messages without an authorized relationship.
3. A counterparty can access only the contract/enquiry records they are entitled to see.
4. Anonymous/public requests can read only explicitly public published data.
5. Drafts, moderation records and unpublished attachments remain private.
6. A worker can perform only its scheduled task and cannot access unrelated account data.
7. A connection returned to the pool after User A's request does not retain User A's identity when reused for User B or an anonymous request.
8. Missing context denies access by default.
9. The migration owner can migrate; the runtime role cannot create, alter, drop or truncate application tables.
10. CI tests run against a real PostgreSQL service with the same role grants and RLS settings used by production.

## 7. Rollout sequence

1. Inventory every table, query path, worker and service credential.
2. Create the separate roles and grant matrix in a controlled Render database administration session.
3. Add the migration/runtime connection-string split and verify deploy/migration operations.
4. Implement transaction-local request identity context and refactor all pool query/connection paths.
5. Add RLS policies in a new migration with RLS disabled initially or applied only to a test schema.
6. Run cross-user, cross-organization, anonymous and pool-reuse integration tests.
7. Enable RLS and FORCE RLS in production only after the tests pass and a recovery plan is approved.
8. Verify production permissions and application workflows after deployment; retain evidence of role grants, policy coverage and test runs.

**Do not execute a bulk `ENABLE ROW LEVEL SECURITY` migration against the current production schema.** The present API is not yet using a complete transaction-scoped identity context.
