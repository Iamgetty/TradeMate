# PostgreSQL roles and Row-Level Security design

**Status:** Role/grant and request-context groundwork is implemented and CI-tested; production role cutover and RLS are not yet enabled.  
**Applies to:** Render PostgreSQL, API connection pool, migration runner and background workers.

RLS must be introduced only after the runtime role, request context and connection-pool behaviour have been tested. The current API issues queries through a shared `pg.Pool` and also opens explicit transactions. Enabling policies before those paths establish transaction-local identity would break legitimate workflows and could create unsafe partial coverage.

## 1. Role separation

| Role | Login | Ownership | RLS bypass | Intended access |
| --- | --- | --- | --- | --- |
| `trademate_migrator` | Yes, deployment only | Owns schema objects and runs migrations | Owner privileges only | DDL and controlled data migrations; never used for web requests |
| `trademate_app` | Yes | No | No | Minimum CRUD privileges required by API; subject to RLS |
| `trademate_worker` | Yes | No | No | Narrow account-deletion processing permissions only |
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

The API now establishes `app.session_token_hash` and `app.user_id` with parameterized `set_config(name, value, true)` calls inside the same transaction as each protected query. The final `true` argument makes each setting transaction-local. The middleware hashes the session cookie with SHA-256; the raw cookie is never placed in PostgreSQL settings. The `database-context.ts` pool wrapper resolves the user ID from the matching unexpired server-side session, then applies context to ordinary `pool.query` calls and explicit checked-out-client transactions. The browser cannot supply or override `app.user_id`. Unit tests cover query transactions, explicit transactions, malformed cookies and concurrent-user identity isolation. Never use session-level `SET` or `set_config(..., false)` with a pooled connection: a reused connection could leak one user's context into another request.

The session bootstrap path must resolve the user from a valid, unexpired, unrevoked session before assigning `app.user_id`. Organization context must be derived from a verified membership record, never trusted directly from a request body or query string.

Every query path must be covered, including direct `pool.query`, explicit `pool.connect()` transactions, public routes, account recovery, webhook handlers and scheduled workers. The current implementation does not yet set `app.organization_id`; organization access must be derived from verified membership in policy expressions or a separately validated context setter. This remains groundwork only. Login/registration bootstrap, TOTP challenge flows, webhook/system operations and worker identity need explicit policy design. The API must not start with RLS enabled until this inventory and refactor are complete.

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

## 8. Render credential setup (owner action required)

Render supports multiple PostgreSQL credentials. Creating a new credential makes it the default credential shown in the dashboard, while existing credentials remain active. Credentials created directly with SQL are not managed or displayed by Render. See the [Render PostgreSQL credential guide](https://render.com/docs/postgresql-credentials).

When the implementation is ready for production role separation:

1. Open the TradeMate PostgreSQL service in the Render Dashboard.
2. Under **Info → Credentials**, create a credential with username `trademate_app`. Copy its connection string immediately and store it only in the API service's `DATABASE_URL` secret.
3. Create a second credential with username `trademate_migrator`. Copy its connection string immediately and store it only in the API service's `MIGRATION_DATABASE_URL` secret.
4. Keep the existing administrator credential available for controlled database administration and the migration workflow until the new credentials have been verified.
5. Connect with the existing administrator credential and run `database/security/001_role_bootstrap.sql` once. It is tested in CI against a clean PostgreSQL database. It does not print or set passwords.
6. Verify the role grants with `database/security/002_role_bootstrap_test.sql` or the CI runner `scripts/test-db-roles.js`.
7. Do not delete or rotate the existing administrator credential until the API and migration jobs have both been verified with their new credentials.

Do not paste either connection string into chat, source control or logs. Do not switch the production API to the new runtime role until the owner-approved rollout step is scheduled. The role bootstrap is tested in CI, but production credentials and access must still be verified on the actual Render database.


## 8. Implemented role-bootstrap groundwork

The CI-tested bootstrap script is `apps/api/database/security/001_role_bootstrap.sql`; its assertions are in `002_role_bootstrap_test.sql`.

- `trademate_app`: runtime CRUD grants, no schema creation, no migration history access and append-only audit-event access.
- `trademate_migrator`: owns application objects and is the only role intended to run migrations.
- `trademate_worker`: limited to account-deletion processing tables and columns; cannot read or modify marketplace enquiries and cannot update or delete audit events.
- The account-deletion worker now expects `WORKER_DATABASE_URL` in production. It no longer mutates historical audit-event actor references; user rows are retained and anonymised.

The CI role bootstrap runs on an isolated PostgreSQL 16 instance. This does not mean the production Render roles have been created. Production role creation and credential cutover remain a controlled operator task after the final grants and RLS policies are approved.


## 9. CI-only RLS pilot evidence

`apps/api/database/security/003_rls_pilot.sql` enables and forces RLS in the isolated CI PostgreSQL database only for:

- `user_preferences`
- `user_notifications`
- `user_auth_security`
- `user_profiles` and `user_follows` (public profile/follow reads with owner-only profile and follower-edge writes)

The matching `scripts/test-rls-pilot.js` test runs as `trademate_app` and verifies private own-row reads, public profile/follow reads, owner-only profile and follower-edge writes, cross-user update denial, rejection of cross-user inserts, anonymous default-deny for private tables, and `FORCE ROW LEVEL SECURITY` against the table owner role. The clean PostgreSQL CI job passed this pilot.

**This pilot is not part of `scripts/migrate.js` and has not been applied to Render production.** It proves the policy pattern for these three tables only. Production rollout still requires the complete policy inventory, authentication bootstrap policies, all-query-path review, role cutover, cross-organization tests, and operational approval.
