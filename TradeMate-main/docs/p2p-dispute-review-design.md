# P2P dispute review workflow — design proposal

## Status and boundaries

**Design only. Not an implemented workflow or authorization approval.**

This proposal addresses P2P-03 in [the P2P lifecycle audit](p2p-lifecycle-audit.md). It defines an internal case-review process only. It does not create escrow, custody, payment processing, bank-transfer reversal, crypto settlement, refund or release capability.

The current API permits a trade participant to open a dispute after the buyer marks payment sent. The trade is moved to `disputed`, but there is no dedicated administrator queue or decision endpoint. The database also permits a `refunded` trade status, but no operational refund capability exists.

## Current authorization constraint

The existing `ModerationController` uses a single `TRADEMATE_REVIEW_API_KEY` supplied in the `x-review-key` header. It compares the key in constant time and records a short hash-derived reviewer key ID for some moderation audit records.

That mechanism is a service-level shared secret, not an individual reviewer identity or a complete staff authorization system. It does not establish named reviewer attribution, per-reviewer roles, separation of duties, revocation of one staff member, or independent approval for sensitive decisions.

**Do not expose dispute decisions through this mechanism without an explicit product/security decision.** Before implementation, choose one of:
1. A staff identity system with individually authenticated accounts, MFA, named reviewer IDs, role-based permissions and revocation; or
2. A formally approved interim service credential model with tightly controlled operators, rotation, access logging and a documented limitation that decisions are attributed to a service credential rather than a person.

The preferred target is individually authenticated staff identities. A shared API key must not be presented as equivalent.

## Proposed case lifecycle

The initial internal-review workflow should be limited to these states:

- `open`: a participant has raised a dispute; awaiting staff review.
- `under_review`: an authorized reviewer has claimed the case.
- `information_requested`: reviewer needs additional information from one or both participants.
- `resolved`: an authorized reviewer has recorded a reasoned administrative outcome.
- `escalated`: case requires a senior reviewer, compliance or legal review.

A resolved case is an administrative decision record only. It must not change the trade to `completed` or `refunded`, claim that funds moved, or claim that an external payment was reversed. Reopening/appeal should be a separately specified policy, not an implicit repeated update.

The trade's existing `disputed` status remains a trading-state guard while the case is open or under review. The case lifecycle should be stored separately from the trade status so that administrative workflow changes cannot accidentally imply settlement.

## Reviewer actions and controls

1. Queue: list disputed cases with pagination, age, asset/fiat, amount, participant references and current review state. Do not expose payment references or sensitive account details in queue summaries.
2. Claim: assign a case to one named reviewer using a row lock and conditional update. A second reviewer must receive a conflict rather than silently overwrite the claim.
3. Request information: record which participant was asked, a bounded reason and a timestamp. Deliver participant notifications through the existing notification system; do not disclose the other participant's private evidence.
4. Record evidence: define permitted evidence types, file size/type controls, malware scanning, private storage, access logging, retention and deletion/legal-hold rules before accepting uploads. Do not put raw evidence or payment credentials in audit metadata.
5. Decide: require an allowed reason code, a bounded written rationale and a named reviewer. Record the decision as an administrative finding only. Require a second authorized reviewer for policy-defined high-risk cases once the approval policy is agreed.
6. Escalate: record the target team/reason and prevent ordinary reviewers from silently closing an escalated case.
7. Notify: notify each participant only about their own case status and the approved outcome summary.

No reviewer action should permit changing bank details, initiating transfers, releasing crypto, moving balances, reversing an external payment or changing a trade to `refunded`.

## Data and audit requirements

A future implementation should use a dedicated dispute-case record (or an equivalently explicit schema) with:
- immutable case ID and trade ID;
- participant IDs stored privately and never returned in public endpoints;
- case state, reason code, timestamps and version;
- assigned reviewer identity and claim timestamp;
- information requests and response timestamps;
- evidence metadata and private object references, never public URLs;
- decision, rationale, reviewer identity and optional second approver;
- escalation and appeal references where policy permits.

Every state change must be conditional, concurrency-safe and committed with its audit event in the same database transaction. Audit events should include actor identity, case/trade IDs, prior/new state, reason code and safe metadata. Never store passwords, tokens, bank account numbers, full payment references or raw evidence in audit metadata. Existing append-only audit protections must apply to the new records.

All read and write routes must enforce staff authorization server-side. Participant routes must enforce case membership and return only the participant's permitted information. Public book/history endpoints must not reveal dispute reason, evidence, reviewer identity or private case state.

## Required tests before implementation is accepted

- Unauthenticated and non-staff requests are denied.
- A participant can only access their own case and permitted updates.
- Staff roles are checked per action; a reviewer cannot grant themselves elevated access.
- Claim races allow only one successful claimant.
- Invalid, duplicate and out-of-order transitions are rejected.
- Reviewer identity and decision rationale are recorded.
- Audit insert failure rolls back the associated case mutation.
- Concurrent decisions cannot overwrite one another.
- Evidence access is private, authorized, logged and malware-scanned.
- Notifications do not leak the other participant's private details.
- Public endpoints remain free of participant IDs, payment references and dispute evidence.
- No endpoint, job or UI claims funds were held, released, refunded or reversed.

## Decisions required before implementation

Product, legal/compliance and security owners must agree:
1. Staff identity provider, MFA and reviewer role model.
2. Permitted decision taxonomy and the exact meaning of an administrative finding.
3. Evidence policy, retention, privacy, data residency and legal-hold requirements.
4. Appeal, escalation, response-time and conflict-of-interest rules.
5. Which case categories require dual approval.
6. Participant notification wording and support escalation.
7. Whether any later payment/custody integration is even permissible in each target jurisdiction; that work requires a separate approved design, threat model and independent assessment.

Until these decisions are approved, keep the current participant dispute-opening capability clearly described as dispute reporting only, and do not represent the service as providing operational dispute resolution or financial protection.
