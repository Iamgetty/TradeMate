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
