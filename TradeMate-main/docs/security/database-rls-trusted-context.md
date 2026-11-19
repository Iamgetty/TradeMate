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
