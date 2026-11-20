# Production database RLS inventory — read-only baseline

**Status:** Inventory baseline only; no policies approved and no production changes.
**Source:** Render PostgreSQL catalog inspection on 2026-11-20. The query was read-only.
**Scope:** 53 public relations: 49 application base tables, `schema_migrations`, and 3 public views.

## 1. Relation inventory

### User identity and authentication
- `users` — account identity/contact/status; private to the account and narrowly authorized support/admin operations.
- `user_profiles` — public-facing profile fields; public projection must not expose private account fields.
- `user_credentials` — password verifier; no direct runtime read/write; scoped authentication functions only.
- `user_sessions` — bearer-token digest and session metadata; no direct runtime token-hash access.
- `user_auth_security` — encrypted TOTP secret/counters; scoped TOTP functions only.
- `auth_login_challenges`, `email_verification_codes`, `password_reset_tokens` — one-time authentication state; scoped functions only.
- `user_deletion_requests` — private account lifecycle state; scoped functions only.
- `auth_rate_limits` — system authentication state; no general user CRUD.
- `user_preferences` — owner-only.
- `user_follows` — relationship visibility and follower-only writes; confirm block/private-account semantics before public read.

### Organization and marketplace
- `organizations` — organization membership/visibility rules; do not assume every organization is public.
- `organization_members` — membership-scoped; membership checks must be derived from trusted rows.
- `organization_documents` — organization-member/reviewer access; uploaded bytes and review notes are private.
- `organization_reviews` — restricted reviewer/system access; reviewer key is not an ordinary user identity.
- `categories` — published reference data; controlled administrative writes.
- `listings`, `listing_media` — published listing reads subject to status/visibility; seller-organization members and authorized moderators control writes.
- `marketplace_enquiries`, `enquiry_messages`, `enquiry_reads` — buyer and seller-organization participants only; read receipts belong to their user.
- `marketplace_contracts`, `marketplace_contract_messages` — buyer/seller counterparties only; messages additionally require contract participation.
- `marketplace_transactions` — buyer/seller participants only; state transitions must be controlled.
- `audit_events` — append-only runtime behavior; visibility must be limited to authorized audit/support roles.

### P2P marketplace
- `p2p_orders` — public-book visibility only for eligible active orders; owner-only mutations and private payment details.
- `p2p_trades` — buyer/seller participants and narrowly authorized dispute reviewers; payment references and dispute data are private.

### Feed and moderation
- `feed_posts` — public reads only for approved/published visibility; author controls own drafts; moderator actions are separate.
- `feed_attachments` — inherit post visibility; binary content must not bypass parent-post policy.
- `feed_comments` — inherit post visibility; author writes and moderation status are distinct.
- `feed_post_reactions`, `feed_post_reshares` — inherit post visibility; user owns their own reaction/reshare.
- `feed_reports` — reporter may create/read own report as product permits; moderation staff only for review fields and all reports.
- `user_feedback` — submitter and authorized support staff only.

### Sports and transfer domain
- `sports_profiles` — owner-controlled visibility; public/private profile setting must be honored.
- `sports_organizations`, `sports_org_memberships` — organization membership/role-scoped.
- `sports_guardian_relationships` — guardian, player (where appropriate), and verified reviewer access; sensitive relationship/evidence fields.
- `sports_player_consents` — grantor, grantee user/org and authorized reviewer; enforce scope, expiry and revocation.
- `sports_representative_mandates` — player, representative, represented organization and verifier; enforce permitted actions, territory and dates.
- `sports_authority_checks` — subject, checked organization and authorized verifier only.
- `sports_transfer_opportunities` — visibility plus creator, player-profile and sporting-organization permissions.
- `sports_transfer_data_sources` — controlled governance/reviewer access; licensing and rights metadata.
- `sports_transfer_external_player_records` — public/restricted source-data policy, claim privacy and review-state controls.
- `sports_transfer_external_player_history` — inherit record/source access; immutable or append-only history for ordinary runtime roles.

### Support and operations
- `support_tickets`, `support_ticket_messages` — ticket owner and authorized support staff; message access inherits ticket access.
- `audit_events` — append-only, restricted audit access (listed above; do not count twice).
- `schema_migrations` — migrator-only; no runtime access.
- `user_notifications` — owner-only, with narrowly controlled system-generated writes.

### Public views (3; not base tables)
- `marketplace_public_completed_trades`
- `p2p_public_book`
- `p2p_public_completed_trades`

Views need a separate review of their definitions, underlying-table permissions, security-invoker/definer behavior and information leakage. Do not assume view visibility is safe because the view name contains “public”.

## 2. Baseline findings

- Catalog reports 53 public relations: 49 application base tables, `schema_migrations`, and 3 views.
- All 49 application base tables currently have RLS disabled and not forced.
- The existing CI pilot covers only `user_preferences`, `user_notifications`, `user_auth_security`, `user_profiles` and `user_follows`; it is not a production migration.
- Existing role bootstrap grants broad CRUD on public tables and future tables, then selectively revokes privileges on authentication/audit objects. This is not a completed per-domain least-privilege grant matrix.
- Production catalog inspection showed all existing base-table owners are the Render-managed database owner. No role bootstrap or ownership changes were performed.
- Catalog foreign keys establish structural relationships, not the full business authorization model. In particular, organization membership, counterparty, moderator, guardian/consent and reviewer authority must be verified from application code and workflow tests.

## 3. Required policy design before implementation

For every table, specify independently:
1. SELECT visibility (public, owner, organization member/role, counterparty, moderator/support, system-only).
2. INSERT identity and allowed parent relationship.
3. UPDATE row predicate and immutable/privileged columns.
4. DELETE rules or explicit prohibition.
5. Worker/feed/webhook/system identity and the narrow function or separate role it uses.
6. Whether SECURITY DEFINER functions must bypass table RLS as their owner, and whether FORCE RLS is safe.
7. Parent-child inheritance rules for attachments, messages, reads, history and other dependent rows.
8. Cross-user and cross-organization negative tests plus anonymous and missing-context tests.

Do not use blanket public-read policies for tables containing private columns or mixed visibility. Prefer safe public views/projections where the product requires public display. A child policy must verify access through its parent, not merely trust a caller-supplied foreign key.

## 4. Blocking questions for source-level verification

- Which API routes and background jobs read/write each relation, and under which identity?
- Are there moderation/admin roles or reviewer-key functions that are not represented by end-user session identity?
- Which public profile, feed, listing, sports-profile and P2P states are actually visible to anonymous users?
- Do any query paths depend on cross-user reads (for example, seller inboxes, organization dashboards, public counts or feed aggregation)?
- Which views are security invoker versus owner-executed, and do they expose columns not intended for public access?
- Which security-definer functions rely on table-owner bypass, and how will their ownership and grants be preserved after migration?
- Can runtime CRUD be reduced to explicit table/column/function grants without breaking writes performed by trusted lifecycle functions?

## 5. Safe next sequence

1. Map every relation to concrete API modules, SQL statements, workers and scheduled jobs.
2. Resolve the blocking questions above against code and tests; mark each operation as public, owner, member, counterparty, moderator or system.
3. Replace blanket runtime grants/default privileges with reviewed per-table/per-column/function grants in disposable PostgreSQL CI.
4. Extend the RLS pilot in domain-sized increments with real-login positive and negative tests.
5. Validate view security, security-definer ownership, migration order and role bootstrap against PostgreSQL 16 and 18.
6. Only after full coverage and a rollback/forward-fix plan, rehearse on AWS staging and seek explicit production approval.

**Do not run the role bootstrap, enable production RLS, change production grants, or switch production credentials based on this inventory.** This document records catalog facts and provisional policy intent; it is not an authorization specification.


## 6. First source-level access-path review

Reviewed the current PR-branch API source (not just the database catalog):

- `apps/api/src/module.ts` contains the main SQL paths for account, support, organization, listings, enquiries, contracts and P2P workflows.
- Support-ticket routes filter list/detail access by `support_tickets.user_id = authenticated user`; message reads are by ticket ID after the ticket-owner check. The RLS policy for `support_ticket_messages` must inherit ticket ownership rather than trust a ticket ID alone.
- Organization document routes check `organization_members` before upload/list operations. The database policy must enforce active membership/role itself; API prechecks are not a substitute.
- Listing write paths check seller-organization membership; published listing reads join organization status. Listing policies must preserve the intended public published read while restricting draft writes to authorized seller-organization members.
- Enquiry list/detail/reply paths distinguish buyer from seller-organization membership and write read receipts under the current user. `enquiry_messages` and `enquiry_reads` must inherit the parent enquiry's participant access.
- Contract reads join listing, seller organization and buyer; the policy must independently enforce buyer or seller-organization membership.
- P2P order creation/listing filters by authenticated `user_id`; public order-book access is routed through `p2p_public_book`, so its view security must be reviewed before granting runtime access to the underlying order table.
- `market-activity.ts` and `market-highlights.ts` aggregate listings, enquiries and contracts across organizations. These cross-organization analytics paths need an explicit authorization decision (for example, only the caller's organization scope or a deliberately public aggregate) before RLS can be enabled. Do not assume their current SQL joins constitute authorization.
- The module has additional direct reads/writes beyond these examples. This is a first-pass mapping, not an exhaustive route-to-table certification.

### Immediate design consequences

1. Do not implement RLS on `marketplace_enquiries`, `enquiry_messages`, `enquiry_reads`, `marketplace_contracts`, `marketplace_contract_messages` or `support_ticket_messages` using only a direct user_id equality. Their access is inherited through parent rows and, for sellers, verified organization membership.
2. Do not enable RLS on `listings` or `organizations` until aggregate/highlight routes and anonymous published-data routes are explicitly classified.
3. Review `p2p_public_book`, `p2p_public_completed_trades` and `marketplace_public_completed_trades` definitions and view security options before exposing them to the runtime role.
4. Continue mapping the remaining sports/transfer, feed moderation, audit, authentication lifecycle and worker paths before drafting production policies.


## 7. Second source-level access-path review: feed, Sports Transfer and authentication

Reviewed the current PR-branch apps/api/src/module.ts and the domain migrations.

### Community feed and moderation

- Feed post reads filter to published rows; comments and attachments join through the parent post and require it to be published. Reaction and reshare writes require an existing published post. These child tables must inherit parent-post visibility under RLS.
- Post creation and ordinary feed interactions use the authenticated session user. Pinning is limited to the post author in the current route; the database policy must not permit a user to pin another author's post.
- Feed report creation records the authenticated reporter. The moderation queue and report review do not use an end-user session: they require the shared TRADEMATE_REVIEW_API_KEY header. The reviewer identifier written to audit metadata is a short hash-derived key ID, not a human staff identity.
- Announcement creation also uses the shared review key. This is a distinct privileged identity and cannot safely be mapped to current_presented_user_id(). If retained, isolate these operations behind a narrow moderation function/role and improve individual reviewer attribution and key rotation/audit controls.
- The report-review transaction locks the open report, optionally hides its post/comment, updates review state and writes an audit event. Ensure the future policy/function preserves atomicity and prevents the reporter or ordinary feed user from reading all reports or setting review fields.

### Sports Transfer

- Profile list/create/update routes are session-authenticated and constrain profile ownership to sports_profiles.user_id. The profile visibility field is returned but the reviewed identity controller does not itself provide a general public profile-discovery route in this path.
- Consent listing and grant/revoke are player-profile-owner operations. Consent grant verifies the recipient exists and limits expiry; revoke also revokes associated representative mandates and sends notifications. RLS must cover those dependent writes and reads atomically.
- Mandate listing distinguishes player ownership from the named representative or active organization owner/admin. Creation requires an exact, current representative_access consent for the target and checks scope; acceptance/rejection is limited to the named representative or eligible organization role; revocation is player-owned.
- Opportunity drafts are private: player-owned drafts or organization recruitment-scoped memberships are the permitted creation/listing paths. The route explicitly creates draft status and says the opportunity is not published/discoverable. Do not infer public-read access from the visibility column or future status values.
- Migrations 027, 029 and 030 describe private identity, consent/mandate, opportunity-draft and sourced-discovery foundations. Migration 030 intentionally omits contact columns and states that public discovery routes are not enabled. Source-governance records and external-player history require separate privileged ingestion/review policies; no worker authorization was certified here.

### Authentication and session lifecycle

- Login obtains password verifier material only through trademate_private.resolve_password_login_credentials(email); session issuance, email verification, TOTP challenges, session listing/revocation and account deletion use dedicated trademate_private functions. These paths must remain function-scoped; do not grant runtime direct SELECT on credential, session-token digest, challenge or reset-token tables.
- Session listing/revocation is bound to the presented session digest. RLS identity must continue to derive from the verified presented session, not caller-controlled user IDs or raw GUC values.
- The authentication rate-limit table is updated by the login route and is system state, not user-owned data. A future role split must preserve narrowly scoped access without opening general CRUD.
- This review confirms the route/function pattern only; function definitions, SECURITY DEFINER ownership/search_path, direct grants, and every caller still require a complete migration-level audit.

### Remaining gaps

1. The shared review-key model needs a deliberate database identity strategy and attributable reviewer controls before production RLS is designed.
2. Feed child-table policies must inherit post visibility; report/reviewer fields must remain privileged.
3. Sports consent/mandate policies must enforce parent ownership, exact grantee, active membership, permission scope, expiry and revocation—not only row ownership.
4. Sports external discovery ingestion/review workers and all scheduled/background jobs remain unmapped.
5. Audit-event writers across domains, P2P transitions, view definitions and every SECURITY DEFINER function still need a complete operation-to-role inventory.

**This remains a source-path review, not an exhaustive authorization certification. No production policy, grant, role, secret or data was changed.**
