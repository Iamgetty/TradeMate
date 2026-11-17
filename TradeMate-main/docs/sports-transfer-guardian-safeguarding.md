# Sports Transfer guardian relationships and safeguarding design

Status: approved product-scope implementation design; not a live workflow.

## Purpose and boundaries

The existing private `sports_guardian_relationships` table is a relationship record, not proof of legal authority and not a permission grant. A parent/guardian relationship must never by itself expose a player profile, authorize representation, permit negotiation, permit document access, or authorize a transfer.

The platform must distinguish:
1. **Relationship claim** — a player or guardian states that a relationship exists.
2. **Counterparty acknowledgement** — the other party accepts or disputes the claim where appropriate.
3. **Evidence review** — TradeMate checks identity and appropriate documentary/legal evidence.
4. **Scoped authority** — a separately recorded, narrow set of permitted actions, only where the applicable law and governing rules permit it.
5. **Player assent/consent** — captured separately whenever legally and developmentally appropriate; guardian authority must not erase a player's voice.

## Required lifecycle

- A relationship request is created by an authenticated player or guardian and is private by default.
- The request identifies one player profile, one guardian user, relationship type, requested scope and expiry/review date. Do not collect a child's full identity documents or sensitive family details in free-text fields.
- The counterpart can acknowledge, decline or dispute the relationship claim. A response is not verification.
- A trained TradeMate safeguarding reviewer records evidence type/reference, source, jurisdiction, decision, reviewer, timestamp, expiry and review notes in restricted records.
- Only a verified relationship may be considered for separately scoped guardian permissions. The platform must check applicable law, competition rules, age/eligibility evidence and any court orders or restrictions before activating an action.
- A player or guardian can report changed circumstances. Revocation/suspension immediately blocks future guardian-authorized actions pending review.
- Expired, disputed, rejected or revoked relationships grant no authority.

## Permission model

The existing allowlist is deliberately narrow: `safeguarding_contact`, `manage_profile_visibility`, `approve_contact`, `approve_opportunity`, and `approve_document_sharing`. Treat these as candidate capabilities, not automatic grants. Never add `negotiate`, `sign`, `receive_funds`, `appoint_agent`, or `transfer_player` as guardian permissions by default.

Every permission must be independently evaluated against:
- verified guardian identity and relationship;
- verified age/eligibility and applicable jurisdiction;
- current relationship status and expiry;
- exact player profile and action;
- player assent/consent where required or appropriate;
- any court order, custody dispute, safeguarding flag or restriction;
- competition/federation rules and applicable law.

Guardian status does not create an agent mandate. If a guardian is also to act as an agent or representative, that requires a separate mandate, conflict review and any applicable licensing/authority verification.

## Minor-player protections

- Do not infer age from missing birth date, appearance, sport, school or account metadata.
- Do not expose date of birth or identity documents in public profile, search, listing, notification or analytics payloads.
- No unsolicited direct messaging to a minor; use restricted, monitored and policy-approved communication paths.
- Do not allow public discovery of a minor by default. Guardian involvement does not make a minor's profile public.
- Prevent a single guardian relationship from bypassing a second-guardian, custody, court-order or jurisdiction-specific review where relevant.
- Escalate suspected coercion, trafficking, grooming, exploitation, document retention, unlawful fees or suspicious cross-border recruitment to trained safeguarding staff.
- Provide confidential reporting, evidence preservation, appeal and anti-retaliation handling.
- Keep medical, school, home address, identity and family information outside general sports profile and deal-room access.

## Reviewer controls and audit

- Reviewer access is least-privilege, MFA-protected and logged.
- Evidence is stored in a dedicated restricted evidence service or reference, not in public-facing profile tables.
- Record evidence category, issuing authority/source, jurisdiction, review result, reviewer, timestamp, expiry and reason codes. Avoid copying unnecessary document contents.
- Separate the person who submits a claim from the reviewer who verifies it.
- Require periodic revalidation and event-triggered re-review after expiry, dispute, legal change, custody change or credible report.
- Maintain append-only audit events for request, response, evidence review, scope grant/change, access, suspension, revocation and appeal.
- Provide a documented human-review fallback where official registries are inaccessible, including for African and other underserved markets; do not silently treat lack of an API as proof of invalidity.

## API and data requirements before implementation

- Add request/response fields only through a migration with explicit constraints and backward-compatible defaults.
- Add private endpoints for creating a relationship claim, viewing only the caller's relevant requests, responding to a claim, and requesting suspension/revocation.
- Keep reviewer verification endpoints separate from user-facing endpoints and require a dedicated safeguarding permission.
- Do not return evidence references or reviewer notes to unrelated users.
- Use indistinguishable not-found responses for unauthorized access to private relationships.
- Enforce transaction-level row locks and state-transition checks; reject stale, expired or duplicate responses.
- Do not add public guardian or minor directory endpoints.
- Do not activate guardian permissions through a generic consent endpoint or by changing `verification_status` alone.

## Release gates

Before enabling guardian workflows:
1. Legal/safeguarding review for launch jurisdictions and supported competitions.
2. Identity and relationship evidence policy with manual-review operations.
3. Verified age/eligibility source and safe failure path; no age inference.
4. Privacy and threat-model review, including abusive guardian, impersonation, custody disputes and compromised accounts.
5. Tests for outsider denial, guardian self-claim, false relationship, expired/revoked status, conflicting guardians, court restriction, minor contact, document access, audit completeness and appeal.
6. Support escalation, trained reviewers, response SLAs and incident playbooks.

This design does not claim that TradeMate currently verifies age, guardianship, custody or legal authority. No guardian permissions should be exposed until these gates are met.
