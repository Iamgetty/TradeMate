# Sports Transfer — technical foundation and implementation contract

**Status:** design specification; not an implementation or a claim of regulatory approval.  
**Launch sports:** association football and basketball.  
**Compatibility:** retain the existing Contract Category division key `sports`; the visible product name is Sports Transfer.

## 1. Source audit: what exists today

The current API is a NestJS application with controllers consolidated in `apps/api/src/module.ts`, Zod request validation in `apps/api/src/validation.ts`, and PostgreSQL migrations under `apps/api/database/migrations`.

The existing marketplace foundation provides:
- Organization membership with owner/admin/member roles and organization document uploads/review.
- Category listings with a persistent draft → pending review → approved/public discovery lifecycle.
- Enquiries and messages.
- A marketplace contract record tied to one listing, one buyer user and one seller organization. It stores one amount/currency, scope, terms, dates and a small proposed/accepted/rejected/cancelled/completed/disputed state set.
- Immutable audit-event history and user notifications.

It does **not** currently provide:
- A player identity/profile or a player-owned sports identity separate from a business organization.
- Clubs, teams, leagues, associations, agencies and sporting registrations as typed domain entities.
- Agent licensing, a player-specific mandate, signatory authority, guardian relationships or time-bounded consent.
- Transfer-specific transaction records, multiple clubs/teams, player-side approvals or multiple-party deal structures.
- Confidential deal-room membership, versioned term sheets, signature events or official clearance/registration records.
- A sourced transfer-window calendar or a trusted feed of official transfer activity.

The current listing API requires an organization membership and a price. The current contract API assumes a buyer-to-seller-organization proposal with one amount. These are useful marketplace primitives but are not a safe substitute for transfer domain records.

## 2. Product boundary and three independent truth layers

Every transfer opportunity and transaction must keep these facts separate:

1. **Commercial agreement:** parties have negotiated and reached an agreed position, with an explicit status and timestamp.
2. **Document execution:** the relevant parties have signed the current version of the agreement. A typed name, uploaded draft or verbal agreement is not a signature.
3. **Sporting/official clearance:** the relevant league, federation, association or other competent body has accepted/recorded the move where required.

No one layer automatically advances another. TradeMate must never display “completed”, “registered” or “official” solely because users marked a commercial deal agreed or uploaded a signed document.

The existing public listing moderation flow remains appropriate for public discovery content only. Private player details, negotiations, contracts, identity documents and medical information must never be submitted to the public listing moderation queue.

## 3. Proposed domain model

Use separate domain tables, linked by UUID, instead of overloading `listings` or `marketplace_contracts`.

### Identity and authority
- `sports_profiles`: user-owned profile; sport, disciplines/positions, public biography, public media references, visibility state and profile verification state. Keep legal identity and date-of-birth data in restricted verification records, not public profile columns.
- `sports_organizations`: typed sporting entity linked optionally to an existing TradeMate organization; entity type (club/team/academy/league/federation/association/agency/school), country, governing body and verification state.
- `sports_org_memberships`: user, sports organization, role, permission scope, status, effective dates and audit metadata. Existing organization roles are not automatically sports signing authority.
- `sports_representative_mandates`: player, representative, permitted actions, sport/territory/competition scope, start/end, status, evidence reference, verification state and revocation history. A representative profile or agency affiliation is not proof of a mandate.
- `sports_guardian_relationships`: minor player, verified guardian, evidence, scope, status and effective dates. Guardian access is narrowly scoped and auditable.
- `sports_authority_checks`: entity, person, authority type, source/evidence, reviewer, outcome, expiry and audit trail.

### Opportunity and transaction
- `sports_opportunities`: sport, movement type, player/team/club references, origin/destination context, season/competition, public/private/invitation visibility, creator, consent reference, summary, status and expiry. No mandatory transfer fee; support undisclosed, negotiable, loan, swap and structured consideration.
- `sports_opportunity_parties`: opportunity, person or organization, role (player, guardian, current club, destination club, agent, scout, adviser), access level and invitation/acceptance state.
- `sports_transactions`: sport-specific transaction type, primary opportunity, season/competition, lifecycle state, creator, timestamps and current version.
- `sports_transaction_parties`: transaction party, role, represented principal, authorization snapshot, approval requirement and party-specific status. Support multi-club/multi-team basketball trades and football swaps/loans without assuming only two parties.
- `sports_transaction_terms`: immutable versioned term sheets; structured consideration components (fixed fee, instalments, bonuses/add-ons, sell-on, loan fee, option/obligation, swap component, draft rights/picks where allowed), currency, disclosure level, effective dates and supersession links. Amounts may be undisclosed; never invent estimates.
- `sports_transaction_conditions`: due diligence, medical condition (only completion state, not medical details), work/immigration eligibility where applicable, contract conditions, league/federation approval, international clearance and other conditional milestones.
- `sports_transaction_events`: append-only lifecycle events with actor, role/authority snapshot, from/to state, reason, timestamp and correlation ID.
- `sports_deal_room_members`: transaction, user, role, granted scopes, invitation/acceptance, expiry and revocation.
- `sports_deal_documents`: private object reference, document type, version, checksum, malware-scan state, visibility scope, uploader and retention state. Do not put file bytes or public URLs in general transaction responses.
- `sports_signatures`: document version, signer identity, signer authority/mandate snapshot, provider envelope/reference, signature state, timestamps and verification evidence. Provider integration must be adapter-based.
- `sports_clearance_records`: transaction, governing body/competition, submission reference, status, decision, effective date, official source/evidence, verifier and last-checked timestamp. This is distinct from commercial acceptance.
- `sports_disputes`: transaction, reporter, category, restricted evidence, status, assigned reviewer, outcome and appeal history.

### Transfer windows and activity
- `sports_competitions`: sport, governing body, country/territory, competition level, gender/category, season and rule-source metadata.
- `sports_registration_windows`: competition, window type, local start/end, IANA time zone, UTC-normalized instants, status (confirmed/provisional/corrected), authoritative source URL/reference, published/effective dates, last verified time and correction history.
- `sports_activity_items`: source-attributed confirmed announcement, reported/rumoured item, correction or official update. Store source, publication time, checked time and confidence class. Reports/rumours must never be styled as confirmed transfers.

Use foreign keys, check constraints, partial indexes and row-level access controls where appropriate. Add append-only event/audit history for authority, consent, document, signature and clearance changes.

## 4. Lifecycle and sport-specific rules

A shared lifecycle engine may provide common states:
`draft → open/available → interest → negotiating → agreed_in_principle → documents_pending → signed → clearance_submitted → registered/approved → completed`.

Terminal or exception states include `withdrawn`, `expired`, `rejected`, `disputed` and `cancelled`. Actual allowed transitions depend on movement type, sport, competition and applicable rules. Do not force every transaction through every state.

Football and basketball must use distinct movement-type registries and rule adapters:
- Football: permanent transfer, loan, loan with option/obligation, extension, recall, free-agent move, pre-contract where permitted, swap, youth/academy move and international clearance.
- Basketball: free-agent signing/re-signing, restricted/unrestricted free agency where applicable, direct/multi-player/multi-team trade, draft rights/picks where permitted, waivers/claims, assignment/two-way/development, buyout, international clearance and contract assignment.

Trials, scouting invitations, renewals, releases, waivers, draft declaration and official registration are not interchangeable with a completed transfer. Rules must be versioned by governing body, competition, season and effective date. Do not hardcode one league's rules globally.

## 5. Consent, safeguarding, privacy and fraud controls

- Player-controlled, purpose-specific, time-bounded and revocable consent governs profile discovery, representative access, opportunity publication, negotiation and document sharing separately.
- A representative must have a verified, current mandate for the specific action, territory and scope. Check authority again at critical transaction transitions; store the authority snapshot used for each approval.
- Minors require verified guardian authority and safeguarding review. Default to restricted discoverability, controlled contact and no unsolicited direct messaging. Do not expose minor profiles to public transfer search by default.
- Identity and organization verification states are separate. KYB of a club does not verify a player; a KYC check does not prove agent mandate or club signatory authority.
- Restrict legal identity documents, contact details, contract values and medical records by least privilege. Medical details must be separately stored, purpose-bound and explicitly consented; only a minimal eligibility outcome may be exposed to deal participants.
- Add anti-impersonation, duplicate identity, forged mandate/document, coercion, trafficking, unlawful fee, harassment, collusion and match-fixing reporting paths, with human review and appeal.
- Use private object storage, malware scanning, file type/size validation, encryption, short-lived access links, download audit, retention controls and incident response.
- Do not provide escrow, custody, payment or commission settlement in this workstream. Any future money movement requires a separate legal, licensing, risk and provider architecture.
- Cross-border flows need jurisdiction-aware policy review; automated checks must have documented manual fallback where official registries are unavailable.

## 6. API surface (proposed, not implemented)

Prefer dedicated routes with explicit role checks:
- `GET/POST /sports/profiles`, `PATCH /sports/profiles/me`, visibility and consent endpoints.
- `GET/POST /sports/organizations`, memberships, verification and authority endpoints.
- `POST/GET /sports/mandates`, accept, revoke and expiry handling.
- `GET/POST /sports/opportunities`, private invitation and party responses.
- `GET/POST /sports/transactions`, party approval, terms versioning and guarded lifecycle transitions.
- `GET/POST /sports/transactions/:id/room-members`, documents, comments/messages, signature envelopes and audit timeline.
- `GET /sports/windows`, admin/provider ingestion and source correction endpoints.
- `GET /sports/activity`, source-attributed confirmed/reported feeds.
- `POST /sports/transactions/:id/clearance`, reviewer/provider update and evidence history.
- `POST /sports/transactions/:id/disputes`, report, review and appeal.

Every private read/write must authorize the current user against the specific opportunity/transaction, accepted room membership, current role, scope, consent and authority. Never rely on a client-supplied role or organization ID alone. Use transactional writes, row locks for competing transitions, idempotency keys for external callbacks and append-only audit events.

## 7. Integrations and data-source policy

Build provider-neutral adapters. Candidate providers are evaluation items, not selected, contracted or integrated:
- Official governing-body and league sources first: FIFA/member associations, FIBA, NBA/WNBA and national/regional leagues. API access, licensing and permitted use must be confirmed; never assume access to FIFA TMS or private registration systems.
- Licensed sports data candidates: Sportradar and Stats Perform/Opta, subject to coverage, redistribution rights, cost and sport/competition diligence.
- Identity/KYB candidates from the global TradeMate register: Sumsub, Veriff and Trulioo; regional fallback evaluation includes Smile ID and Dojah. Vendor country coverage and document types require real validation.
- Agent licence/registry sources, electronic signature, private storage, malware scanning, transactional email, optional SMS/voice, calendar, timezone/geocoding, translation, sanctions/PEP/adverse-media checks where lawful, document authenticity, fraud tooling and security testing.
- Official dates and registration decisions are authoritative only when supported by a governing-body/league source. Commercial data feeds are supplemental. Rumours require clear attribution and a distinct visual/status treatment.

## 8. Recommended delivery sequence and release gates

1. **Foundation and threat model:** approve domain vocabulary, identity model, consent scopes, authority/mandate model, minors policy, threat model and retention policy.
2. **Database/API foundation:** create domain tables, private authorization helpers, audit events, role/consent/mandate checks and tests. No public profile or transaction screen before access controls exist.
3. **Sports Transfer home and profiles:** role-aware navigation and player/club/agent profiles backed by server data; private by default where appropriate.
4. **Transfer-window centre:** ingestion with official source, local timezone, verification status, correction history and freshness. No fabricated sample dates in production.
5. **Football MVP:** one clearly scoped movement path end-to-end, then expand movement taxonomy. Keep commercial agreement, signed documents and official registration distinct.
6. **Basketball MVP:** separate trade/FA/draft/waiver rule adapters and multi-party transaction tests.
7. **Deal Room and workspaces:** party membership, versioned terms, secure documents, signatures, audit, club/agent workflows and notifications.
8. **Licensed data and external services:** integrate only after coverage, legal rights, security, cost and fallback diligence.
9. **Staged release:** abuse testing, safeguarding review, privacy review, penetration testing, accessibility, low-bandwidth/mobile QA and monitored rollout.

Release blockers: unauthorized access tests; mandate/guardian revocation tests; minors privacy tests; document isolation and malware handling; multi-party authorization; state transition/concurrency tests; sport-specific rules tests; audit completeness; and proof that “signed” never implies “registered”.

## 9. Explicit non-goals for the first foundation

- No transfer-window dates generated from assumptions or copied without source rights.
- No fake player, club, agent, transfer, valuation or registration data presented as real.
- No automated claims that a player is available, a representative is authorized, or a transfer is complete without verified evidence.
- No public access to negotiation or identity documents.
- No escrow, payments, commissions, custody or wallet changes.
- No assumption that the current one-business-space-per-account policy is being changed by this work.
- No removal or renaming of the existing `sports` database division key.
