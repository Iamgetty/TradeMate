# Sports Transfer — Global Transfer-Window Centre

Status: product and technical specification. This is not a live calendar, source integration or verified schedule.

## Product purpose

Provide a reliable global calendar of registration and roster-movement periods for football and basketball. It must answer: which governing body or competition controls the period, who it applies to, what kind of movement it governs, when it opens and closes in the relevant local time zone, what exceptions apply, and when TradeMate last verified the information.

A single generic "transfer window" per country is incorrect. Men's, women's, youth, amateur, professional, domestic and international periods may differ. Basketball trade deadlines, free-agency periods, waiver windows and draft events are not interchangeable with football registration windows.

## Calendar dimensions

Each record must identify:
- Sport and movement family (football registration, basketball trade, free agency, draft, waiver/claim, international clearance, etc.).
- Governing authority and jurisdiction; country/territory code where applicable.
- Competition, league, association, division, gender/category, age group and season, with explicit applicability.
- Window/event type, eligibility scope and permitted transaction classes.
- Opens-at and closes-at as timezone-aware instants; original source-local date/time and IANA timezone.
- Exceptions, extensions, special dispensation notes and affected cohorts.
- Status: scheduled, open, closing soon, closed, suspended, extended, corrected, cancelled, or unknown.
- Evidence source, source document/page, publication/effective date, retrieved-at timestamp, last-verified timestamp, verifier and verification method.
- Confidence: officially confirmed, provisional official notice, secondary report, or unverified. Only official confirmation may drive hard deadline warnings or eligibility gates.

## Authority and source hierarchy

1. Official federation, association, league or competition publication and authorized registration platform notice.
2. Official circular, rulebook, bulletin or direct written confirmation from the competent authority.
3. Licensed commercial sports data supplier, used as a supplemental feed and reconciled against official sources.
4. Reputable secondary reporting, displayed as a report and never silently promoted to an official deadline.

FIFA/member associations are relevant authorities for football within their respective scope; FIBA, national federations and individual leagues govern their own basketball contexts. NBA/WNBA dates and rules must not be generalized to other competitions. Access to FIFA TMS, ITC or private league systems must never be assumed. The product must record access rights and source licensing before ingestion or redistribution.

## Data model proposal

- `sports_competitions`: sport, governing body, jurisdiction, competition identity, level, category, season and official source identity.
- `sports_window_sources`: publisher/authority, source type, source URL or restricted reference, license/permission, retrieval method and trust tier.
- `sports_registration_windows`: competition, season, movement type, scope, start/end instants, source-local representation, status, confidence, source reference, verification metadata and current version.
- `sports_window_exceptions`: exception type, affected cohort, effective period, authority reference and review status.
- `sports_window_revisions`: append-only prior/new values, reason, source evidence, actor, timestamp and correction linkage.
- `sports_window_subscriptions`: user, competition/filter, reminder preferences, timezone and delivery channel.
- `sports_window_alerts`: scheduled reminder intent, deduplication key, delivery state and audit metadata.

Store instants in UTC using PostgreSQL timestamptz, while preserving the original IANA timezone and source-local date/time. Never store a local wall-clock deadline without its timezone. Daylight-saving transitions and midnight boundaries require explicit tests.

## Ingestion and verification workflow

1. Discover candidate source and record its authority, scope, licensing and permitted use.
2. Capture the source evidence and publication/effective date; do not scrape restricted systems or bypass access controls.
3. Parse into a proposed revision, retaining raw source representation and parser version.
4. Validate competition/category/season applicability, timezone, ordering, duplicates and conflicting periods.
5. Require human verification for new authorities, conflicting data, unusual extensions, ambiguous scope or low-confidence extraction.
6. Publish with visible confidence label, source attribution and last-verified timestamp.
7. Re-check on source change, approaching deadlines and a defined freshness schedule.
8. Corrections create a new revision; preserve previous values and notify affected subscribers when a material deadline changes.

No date may be invented to fill a missing source. Missing or conflicting dates display "Not confirmed" with the reason and source-check timestamp.

## User experience

- Global overview with filters for sport, country/association, competition, gender/category, age group, season and movement type.
- Separate football and basketball views with terminology appropriate to each sport.
- Competition detail shows the applicable window, exceptions, source, confidence, last verified and revision history.
- Calendar and list modes, local-time display with timezone disclosure, deadline countdown only for officially confirmed dates.
- Save competitions/filters; reminders at user-selected intervals; calendar subscription/export only after timezone and update semantics are validated.
- Clearly distinguish opening/closing of registration windows from trade deadlines, draft dates, free agency, waiver periods and clearance processing.
- Accessibility, localization, mobile and low-bandwidth support; never rely on colour alone for confidence/status.

## Transaction safeguards

- A calendar deadline is advisory unless the relevant authority confirms the applicable rule and the transaction's eligibility.
- Before any transaction advances to submission, re-check the current competition rule profile, relevant window and exception evidence.
- Store a snapshot of the rule/source version checked at the transition, with timestamp and actor.
- Do not equate a window being open with a player being eligible or a transaction being approved.
- Keep commercial agreement, signed documents and official registration/clearance as separate states.
- When source confidence is provisional or unknown, do not block or certify a deal automatically; route to authorized human review.

## Alerts and operations

- Use a durable queue/event scheduler with idempotent delivery and retry/dead-letter handling.
- Deduplicate reminders by user, window revision, reminder type and scheduled instant.
- Respect user timezone, quiet hours, channel consent and notification preferences.
- Notify subscribers of material date changes, cancellations and corrections, including the old and new values and official source.
- Monitor stale sources, failed fetches, parser drift, conflicting dates, undelivered alerts and unusually frequent corrections.
- Keep an operator audit trail; source ingestion credentials and provider webhooks must be least-privilege and secret-managed.

## Release gates

1. Confirmed official sources and legal/licensing permission for each launch competition.
2. Human verification and correction workflow with named operational ownership.
3. Competition/category/season data model validated against football and basketball examples without assuming one global rule.
4. Timezone, daylight-saving, leap-day, midnight, extension, cancellation and conflict tests.
5. Provenance, revision history, last-verified freshness and public confidence labels.
6. No fabricated seed dates in production; test fixtures clearly marked synthetic.
7. Notification consent, idempotency, delivery monitoring and correction alerts.
8. Rule snapshot and re-check integration tested before transaction submission.
9. Accessibility, localization, mobile and low-bandwidth acceptance.

## Initial implementation sequence

1. Inspect existing schema, API conventions, admin/moderation permissions, notification queue and app navigation.
2. Add competition/source/window/revision tables and read-only public endpoints with strict source metadata.
3. Add restricted source-ingestion and human-verification operations.
4. Build the calendar UI using current TradeMate components and responsive patterns.
5. Add subscriptions and deadline alerts only after source freshness and queue delivery are reliable.
6. Connect transaction eligibility checks only after sport/competition rule profiles are independently tested.

No live dates, provider access, official integration or transfer eligibility is claimed by this specification.
