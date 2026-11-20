# ADR: Trusted PostgreSQL request identity for Row-Level Security

- **Status:** Proposed; implementation and production use are blocked
- **Date:** 2026-11-19
- **Scope:** PostgreSQL RLS request identity for the TradeMate API
- **Related:** `docs/security/database-rls-design.md`

## Context

The current RLS pilot predicates compare row ownership with
`current_setting('app.user_id', true)`. The API's `database-context.ts`
derives the value from a hashed session cookie and an active server-side
session, then sets it transaction-locally. This protects against browser input
being copied directly into the setting and reduces connection-pool leakage.

It does **not** make the setting an independently trusted database identity.
A SQL caller using the shared `trademate_app` role can call
`set_config('app.user_id', another_user_id, true)`. The current pilot test
itself sets this value directly. Consequently, its cross-user assertions test
policy behavior under a correctly supplied context, not resistance to context
forgery by an arbitrary SQL caller.

## Security objective and threat boundary

The target is to prevent SQL executed with ordinary `trademate_app` privileges
from choosing another user's RLS identity merely by changing a custom GUC.

This is a database authorization backstop, not a claim that RLS can contain a
fully compromised API process. If an attacker controls the API process and its
identity-signing capability, application authorization can also be bypassed.
SQL injection, credential theft, process compromise and privileged operator
access remain separate threat scenarios and require their own controls.

## Candidate design to validate

Evaluate a transaction-bound, signed identity assertion:

1. The API authenticates the request from the server-side session store and
   derives the user ID; request bodies, query parameters and browser-supplied
   user IDs are never identity sources.
2. A narrowly scoped signing component creates a short-lived assertion binding
   the user ID, session identifier/digest, audience, expiry and a unique
   transaction/request nonce.
3. PostgreSQL verifies the assertion using verification material unavailable
   to `trademate_app`; the application role cannot read signing keys or write
   trusted identity records.
4. A tightly scoped `SECURITY DEFINER` verifier records the verified identity
   in a private schema/table bound to the current backend and transaction
   (for example backend PID plus transaction ID), or exposes an equivalently
   protected verified-context function. RLS policies read only that verified
   context, never the caller-settable `app.user_id` GUC.
5. Function ownership, fixed `search_path`, schema qualification, EXECUTE
   grants, row/table privileges, cleanup and transaction rollback semantics
   are reviewed explicitly. The function must not provide a general identity
   setter or accept unsigned user IDs.

This is a candidate, not an approved final architecture. Evaluate key rotation,
replay resistance, transaction pooling/proxies, nested transactions, async
workers, migrations, session revocation and operational recovery before
implementation. Do not put a signing secret in a GUC, SQL parameter log,
application-readable table or repository file.

## Required adversarial acceptance tests

Run against the same PostgreSQL major version and grants intended for
production, using the real runtime role:

- Direct `set_config('app.user_id', victim_id, true)` cannot change the
  identity seen by any RLS policy.
- Direct writes to private context tables and direct calls to internal verifier
  helpers are denied.
- Missing, expired, malformed, wrong-audience, altered and replayed assertions
  fail closed.
- A valid assertion grants only its bound user and only within its bound
  transaction; commit, rollback and pooled connection reuse do not retain it.
- A and B concurrent requests cannot cross identities.
- A user cannot use a valid assertion for one transaction/backend in another.
- Session revocation and account deactivation take effect according to the
  documented consistency window.
- Anonymous requests and worker/system identities have explicit, separately
  tested policies.
- The tests prove both positive access for the owner and negative access for
  another user across every protected table/policy group.

## Decision gates

Do not enable production RLS or mark the database/security domain production
accepted until:

- The design is reviewed against the complete table/query/worker inventory.
- The signed-context design (or a demonstrably stronger alternative) is
  implemented with least-privilege grants.
- Adversarial tests above pass on the production-equivalent PostgreSQL version.
- All API, worker, webhook, auth-bootstrap and migration paths are covered.
- Staging acceptance, rollback procedure and production owner approval are
  recorded in the implementation register.

## Current disposition

No production schema, role, policy, credential or deployment is changed by
this ADR. The CI-only RLS pilot remains useful as a policy-pattern test but is
not a complete database authorization boundary. Keep production RLS blocked.

## Repository-specific review findings (2026-11-19)

The current pilot's integration script, `apps/api/scripts/test-rls-pilot.js`, executes as `trademate_app` and directly calls `set_config('app.user_id', supplied_user_id, true)`. Its assertions demonstrate that the row policies enforce the supplied identity; they do not demonstrate that the identity is authentic. An arbitrary SQL caller with the runtime role can select either test user's identity and obtain that user's permitted rows. Treat the pilot as policy-expression coverage only.

The role bootstrap, `apps/api/database/security/001_role_bootstrap.sql`, grants the runtime role CRUD privileges across public tables and deliberately gives it no schema CREATE privilege, no object ownership, and no RLS bypass. That is a useful least-privilege foundation, but it does not constrain custom GUC assignment. The trusted verifier must live outside schemas writable by the runtime role, and the runtime role must have no direct read/write privileges on verifier key material or private context state.

Before choosing a cryptographic implementation, explicitly validate these additional constraints:

- **Separate signing and verification authority.** The API signer must not be able to retrieve database verification material through SQL. The runtime database role must not be able to retrieve either key or mint assertions. If symmetric MAC verification is selected, document the unavoidable duplication of the MAC secret across the signer and verifier trust domains; compare an asymmetric signature design where PostgreSQL stores only a public verification key.
- **No implicit function exposure.** PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default unless revoked. Every privileged function must have PUBLIC execution revoked, a narrowly granted entry point, a non-login owner, a fixed safe `search_path`, fully qualified object references, and reviewed ownership/grant tests. Internal helpers must not be callable by `trademate_app`.
- **Transaction binding must be real.** Bind the verified assertion to database-generated transaction identity and the current backend, and prove the binding cannot be copied to another transaction or connection. Do not rely on a caller-supplied PID, transaction ID, nonce, or custom GUC as the authority. Verify behaviour with the actual connection pool/proxy mode and nested transaction/savepoint semantics.
- **Replay and cleanup.** Define one-time use, expiry, transaction rollback, commit, connection loss and backend reuse semantics. A verifier must fail closed if durable replay tracking is unavailable; cleanup must not create stale grants or unbounded private state.
- **Role and ownership tests.** Extend role-bootstrap assertions to prove the runtime role cannot access verifier storage, alter verifier functions, change function ownership, or invoke internal helpers. Test both positive owner access and negative cross-user access by connecting with the real runtime login, not only `SET ROLE` under an administrator session.
- **Migration lifecycle.** Create verifier objects and rotate verification material only through the isolated migrator/release path. The long-running API must not inherit migration ownership or verification-key administration privileges.

No trusted-context function, secret, schema, grant, migration or application code is introduced by this review. The current `app.user_id` pilot remains unsafe against identity forgery and production RLS remains blocked.


## Real-login adversarial evidence (2026-11-20)

The new disposable CI test, `apps/api/scripts/test-rls-runtime-login.js`, provisions a random password for `trademate_app` only inside the ephemeral PostgreSQL service, connects with that role as the actual `session_user` and `current_user`, then attempts to forge `app.user_id` to another fixture user's UUID. It confirms the current pilot policy permits that cross-user read. The test is intentionally an expected-vulnerability regression gate: it passes only while the known weakness is reproducible, and must be inverted or replaced when a trusted-context design is implemented.

The test passed on both PostgreSQL 16 and 18 in [PostgreSQL security compatibility run 44686680871](https://github.com/Iamgetty/TradeMate/actions/runs/44686680871), and in the database integration job of [TradeMate CI run 44686680868](https://github.com/Iamgetty/TradeMate/actions/runs/44686680868), against code-bearing head `3d8529b837f9863f9270266d76379f2b9abd245f`. It does not claim that the vulnerability is fixed. It demonstrates why production RLS must remain disabled until the trusted identity design and the full adversarial acceptance suite pass.


## Cryptographic feasibility review and bounded candidate (2026-11-20)

### Verified platform constraints

- PostgreSQL's documented `pgcrypto` module supplies `hmac()`, digest and encryption functions, but its PGP implementation explicitly states that it does not support signing. It is therefore not an Ed25519/RSA signature verifier and must not be treated as one. See the [PostgreSQL 16 documentation](https://www.postgresql.org/docs/16/pgcrypto.html) and [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/pgcrypto.html).
- Render's current managed-Postgres supported-extension list includes `pgcrypto`, but does not list `pgsodium`. Do not assume that a pgsodium-based design can be installed on the current managed database without written provider confirmation or a hosting change. See [Render's supported extensions](https://render.com/docs/postgresql-extensions).
- `pgsodium` exposes libsodium detached Ed25519 verification through `crypto_sign_verify_detached`; this is a technically suitable public-key verification primitive where the extension is available. The extension also supports server key management, but that capability and its operational requirements would need separate review. See [pgsodium's function documentation](https://www.pgxn.org/dist/pgsodium/).
- The libsodium signature primitive is Ed25519; the signer holds the secret key and the verifier needs only the public key. See [libsodium's signature documentation](https://doc.libsodium.org/public-key_cryptography/public-key_signatures).

### Decision

Do not implement an asymmetric PostgreSQL verifier using `pgcrypto`: the required signature-verification primitive is not present in its documented API. Do not add `pgsodium` to production migrations while Render's supported-extension list does not include it.

For the current Render-managed PostgreSQL target, the only built-in candidate worth validating in CI is an **HMAC-SHA-256 assertion with deliberately separated access paths**:

1. The API obtains the authenticated subject only from its server-side session/authentication flow. It signs a narrowly defined assertion using a dedicated secret delivered to the API through the secret manager/runtime environment; the signing secret is never fetched from PostgreSQL.
2. A separate copy of the HMAC verification secret is provisioned into a private database schema through the isolated migrator path. It is owned by a dedicated `NOLOGIN` security owner, not by `trademate_app` or the ordinary API process. The runtime login receives no schema usage, table access, key-read access, key-write access, ownership or role membership that could expose the verifier secret.
3. A minimal `SECURITY DEFINER` entry point, owned by that non-login security owner, verifies the MAC with fully qualified `extensions.hmac` (after controlled installation of `pgcrypto` into a locked extension schema). Revoke EXECUTE from PUBLIC on every security function, grant only the public entry point to the runtime role, and keep parsing/key lookup helpers inaccessible. Use a fixed safe `search_path`, fully qualify all objects, and ensure no untrusted role can create objects in any searched schema.
4. The signed assertion binds subject, fixed issuer/audience, key ID, database identity, `pg_backend_pid()`, database-generated `pg_current_xact_id()`, issue/expiry times, and a cryptographically random nonce. The API begins the transaction, obtains the backend and transaction identifiers from that same checked-out connection, then signs the assertion for that transaction. The verifier reads backend/transaction identifiers itself; it never trusts caller-supplied PID/XID values as authority.
5. The assertion may be carried in a transaction-local custom GUC because the GUC itself is not trusted: its contents are accepted only after MAC verification and backend/transaction/expiry/audience checks. RLS policies call a narrow verified-subject function and never compare rows to `app.user_id`. A caller can alter or clear the GUC, but cannot create a valid assertion for another subject or transplant a token to another transaction.
6. The design must prove savepoint rollback semantics, transaction rollback/commit, connection loss, backend reuse, transaction-pooling/proxy compatibility, session revocation, key rotation and fail-closed behaviour. A token replayed inside the same transaction can only assert the same subject and transaction; cross-transaction replay must fail. Expiry and nonce policy remain mandatory even with transaction binding.

**Important trade-off:** HMAC verification requires the same secret value in two trust domains (API signer and database verifier). This is not asymmetric separation. It is acceptable only if the threat model explicitly treats the API process/signing secret as trusted and protects the database copy from the runtime SQL role. A fully compromised API process can mint assertions and remains outside this RLS backstop's protection. If the product requirement demands that the API signer cannot possess or derive database verification material, this HMAC design does not meet that requirement; the platform must provide a supported asymmetric verifier (for example pgsodium after provider confirmation or a different database hosting model) before implementation.

### CI primitive test

Added `apps/api/scripts/test-rls-hmac-compatibility.js` and wired it into the PostgreSQL 16/18 compatibility workflow. It uses an ephemeral random key, compares PostgreSQL `pgcrypto.hmac(..., 'sha256')` byte-for-byte with Node.js `crypto.createHmac('sha256', ...)`, and checks modified-message and wrong-key rejection. This test proves primitive interoperability only; it does not approve the token format, key provisioning, verifier functions, transaction binding or production RLS. The primitive test passed on both PostgreSQL 16 and 18 in [PostgreSQL security compatibility run 44688695316](https://github.com/Iamgetty/TradeMate/actions/runs/44688695316), against code-bearing head `37550648a9ab71468ba58079c438eea8c20d0f99`. The test was corrected after its first attempt exposed an extension-schema assumption; the final version discovers the installed `pgcrypto` extension schema from PostgreSQL catalogs and qualifies the HMAC function there.

### Open design gates before implementation

- Confirm Render extension placement, version, upgrade behaviour and availability on the actual production/staging database version; the public support matrix currently lists `pgcrypto` but not `pgsodium`.
- Select and threat-model the HMAC duplication trade-off with security review. If rejected, do not force HMAC into an asymmetric requirement.
- Define a canonical, unambiguous signed byte representation and strict parser; reject duplicate/unknown claims, unsupported algorithms, malformed encodings and non-canonical values.
- Specify the security-owner role, private schema, key table, rotation overlap, revocation, backup/restore and migrator-only lifecycle. Ensure API runtime cannot read the DB verifier key through SQL.
- Prove that `pg_current_xact_id()` and `pg_backend_pid()` are read inside the verifier and bind the exact transaction on the same pooled connection; include transaction-pooling tests before supporting a proxy mode.
- Benchmark per-statement/per-row verifier overhead and ensure planner behaviour cannot bypass verification or broaden access.
- Replace the expected-vulnerability test with denial assertions only after the trusted verifier is implemented and the real-login suite proves forged `app.user_id`, altered tokens, expired tokens, replay and cross-transaction transplantation are rejected.

No verifier function, key, private schema, migration or production setting is introduced by this feasibility review. Production RLS remains blocked.


### CI result for the primitive test (2026-11-20)

The corrected test passed on PostgreSQL 16 and 18 in [run 44688695316](https://github.com/Iamgetty/TradeMate/actions/runs/44688695316). The same code-bearing head `37550648a9ab71468ba58079c438eea8c20d0f99` passed all five workflow suites: TradeMate CI [44688695305](https://github.com/Iamgetty/TradeMate/actions/runs/44688695305) (8/8 jobs, including browser two-account acceptance), Cloudflare compatibility [44688695300](https://github.com/Iamgetty/TradeMate/actions/runs/44688695300), npm lockfile validation [44688695352](https://github.com/Iamgetty/TradeMate/actions/runs/44688695352), and AWS infrastructure validation [44688695344](https://github.com/Iamgetty/TradeMate/actions/runs/44688695344).

The first HMAC test iteration failed because it hard-coded the requested extension schema even when PostgreSQL had already installed `pgcrypto` elsewhere. The test now discovers the extension's actual namespace from `pg_extension`/`pg_namespace` and quotes that trusted catalog value before calling `hmac`. Both major versions now pass the byte-for-byte Node/PostgreSQL comparison, altered-message rejection and wrong-key rejection.
