# P2P lifecycle and financial precision audit

## Scope and baseline

Reviewed the current `main` implementation of:

- `apps/api/src/module.ts` — `P2PMarketController` (approximately lines 2387–2564).
- `apps/api/src/validation.ts` — P2P request schemas.
- `apps/api/database/migrations/002_p2p_market_records.sql`.
- `apps/api/database/migrations/006_p2p_order_lifecycle.sql`.
- `apps/api/database/migrations/021_p2p_public_payment_methods.sql`.
- API test and script inventories.

This is a code/schema audit, not a live financial or production-data test. No endpoint, schema, financial calculation, state transition or deployment was changed.

## Current implemented lifecycle

1. An authenticated user creates a buy/sell advertisement.
2. Another authenticated user creates a pending trade against the advertisement.
3. The API locks the advertisement row, reserves quantity and inserts the trade in one transaction.
4. The buyer marks payment sent and may attach a reference.
5. The seller confirms receipt, which marks the trade completed.
6. Before payment is marked sent, the buyer may cancel; the transaction locks both trade and advertisement and restores the reserved quantity.
7. Either participant may open a dispute after payment is marked sent.

Public book and completed-trade views omit account identifiers and payment references. The public book exposes seller-selected payment-method labels only. The API explicitly tells users that TradeMate does not hold funds or provide escrow.

## Findings

### P2P-01 — Financial arithmetic uses JavaScript floating point

**Priority: High — resolve before enabling real-value trading or settlement.**

The P2P controller converts user-supplied prices, quantities and fiat amounts with `Number()` and performs arithmetic in binary floating point:

- Advertisement creation calculates `price * quantity` and compares min/max fiat limits using floating-point arithmetic.
- Order placement calculates `fiatAmount / price`, checks remaining quantity using `Number`, then serializes the result with `toFixed(12)`.
- Cancellation restores reserved quantity by adding values after converting PostgreSQL NUMERIC values to JavaScript `Number`.

The database correctly uses PostgreSQL `NUMERIC` columns, but that precision is lost when values are converted to JavaScript numbers before calculations. `toFixed` formats an already-rounded binary floating-point value; it does not make the preceding calculation exact.

**Required remediation:** use exact decimal arithmetic end-to-end. Either introduce a reviewed decimal library or implement a narrowly scoped fixed-point/BigInt helper with explicit scales for price (10 decimals), asset quantity (12 decimals) and fiat (2 decimals). Define rounding direction and reject values that exceed supported precision. Keep PostgreSQL NUMERIC values as decimal strings at the API boundary. Add property/boundary tests for tiny fractions, repeating divisions, maximum precision, min/max limits, partial fills and cancel/restore cycles. Do not silently round a trade upward or reserve more quantity than is available.

### P2P-02 — No dedicated P2P lifecycle integration test suite found

**Priority: High — required before financial arithmetic or state-machine changes.**

The API test directory and scripts inventory contain validation, auth, database context, organization document and marketplace contract/listing tests, but no dedicated P2P lifecycle integration test file/script.

The current CI database integration covers contract lifecycle/concurrency and other security properties, but does not establish P2P-specific guarantees.

**Required remediation:** add PostgreSQL-backed HTTP integration coverage for:
- unauthenticated access to every private P2P route;
- two-user ad creation and order placement;
- self-trade rejection;
- partial fills and concurrent attempts against the same remaining quantity;
- buyer-only unpaid cancellation and exact quantity restoration;
- payment-sent idempotency and rejection of duplicate transitions;
- seller-only receipt confirmation;
- dispute eligibility for buyer and seller, and rejection before payment-sent;
- competing dispute/confirmation requests;
- public views never exposing user IDs, payment references or account credentials;
- rollback on any failure between trade insertion, quantity reservation and state transition.

### P2P-03 — Disputes can be opened but no P2P dispute review/resolution workflow exists

**Priority: High before presenting disputes as an operationally supported service.**

The API exposes participant dispute creation and changes a trade to `disputed`. The P2P controller has no administrator queue, review, decision, resolution, refund or release endpoint. The schema includes `refunded` but the current P2P controller does not transition a trade into that state.

The general moderation controller reviews organizations and listings; it is not a P2P dispute-resolution workflow.

**Required remediation:** define a separately authorized dispute-review state machine, evidence policy, immutable decision record, reason codes, notifications, escalation and appeal policy. Any refund/release/settlement action must remain disabled until the custody/payment model, legal/compliance requirements and independent audit gates are satisfied. Do not imply that TradeMate can reverse or hold an external bank transfer.

### P2P-04 — P2P state transitions do not write domain audit events

**Priority: High for a trust-sensitive financial workflow.**

The P2P controller's advertisement, trade, payment-sent, confirmation, cancellation and dispute mutations do not write corresponding rows to the immutable `audit_events` table. The existing immutable audit-event infrastructure does not by itself provide P2P event coverage.

**Required remediation:** define event types and append-only event payloads for every P2P state transition. Insert the event in the same database transaction as the state mutation, with actor, trade/ad identifier, previous/new state and safe metadata. Never place passwords, session tokens, bank details or payment credentials in audit metadata. Add rollback and immutability tests.

### P2P-05 — Advertisement expiry and stale-order handling are not implemented in the P2P controller

**Priority: Medium — operational lifecycle gap.**

The P2P order schema supports `expired`, but the reviewed controller exposes create/list/cancel operations without an expiry timestamp, expiry job or stale pending-trade resolution path. A user may leave an advertisement or pending trade open indefinitely unless another participant completes or cancels it.

**Required remediation:** define explicit ad expiry and pending-trade timeouts, with a scheduled worker that uses row locks and idempotent transitions. Decide how reserved quantity is restored and how disputes/payment-sent trades are excluded. Test worker retries and races with user actions before enabling it.

## Explicit non-findings / boundaries

- The existing P2P implementation is not escrow, custody or a payment processor. Do not describe it as such.
- The current public views do not intentionally expose participant identity or payment credentials.
- Order creation and unpaid buyer cancellation already use transactions and row locks; preserve these protections.
- Public payment-method labels are not bank account details.
- This audit does not authorize connecting a wallet, accepting crypto deposits, holding funds, issuing refunds or settling fiat payments.

## Recommended order of work

1. Build P2P PostgreSQL-backed lifecycle tests and a two-party concurrency test harness.
2. Implement exact decimal/fixed-point calculations with precision and rounding rules, backed by tests.
3. Add transactional immutable P2P audit events.
4. Design dispute review/resolution as an explicitly authorized workflow, without custody or external-payment claims.
5. Add ad and pending-order expiry only after its reservation and payment-state rules are agreed and tested.
6. Keep escrow, custody, fiat deposit/withdrawal, crypto transfers and international remittance gated by the existing roadmap's legal, compliance, threat-modelling and independent security-audit requirements.

Each implementation step should be a separate reviewable change with API build, security tests and PostgreSQL-backed integration tests. No production migrations or deployments should be bundled into these changes.
