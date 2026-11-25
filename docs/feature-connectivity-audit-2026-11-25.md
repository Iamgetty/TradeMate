# TradeMate full-stack feature connectivity audit — 25 November 2026

## Scope and verification method

This is a source-to-runtime audit of the deployed TradeMate web runtime and the API/feed infrastructure, not a claim that every user journey has passed browser acceptance.

Verified:
- Deployed `https://trademate.cfd/tm/app.js?v=173` is byte-for-byte identical to `main:TradeMate-main/apps/web/public/tm/app.js` (439,187 bytes; SHA-256 `c7780714811958b4a9e979dc6c281a5db82edf60c853ec14642a1cfe1a4411f1`).
- Web runtime sets `TM_CONFIG.api = '/api'`; API global prefix is `/api`.
- API live checks: `GET /api/health` = 200; `GET /api/health/database` = 200 with database connected; unauthenticated `GET /api/auth/me` = expected 401.
- `GET /api/feed/posts?limit=40` = 200.
- Feed service `GET /health` = 200, 5/5 exchange sockets reported live and 75 books at audit time; MT5 quote count 0; FX state `not_configured`.
- AWS target PostgreSQL feed-post ownership query: 1 post, 0 null author IDs, 0 orphaned author IDs. The live post ID `185e778f-26ba-489f-9da2-7b9007a9faf7` has author user ID `46fb2391-c92e-44da-89c1-b78a3f275082`, resolving to display name `Deukleinz`. No data repair was necessary.
- Current source contains 101 decorated NestJS route handlers and 75 distinct literal frontend API call sites. This count is source inventory, not proof every endpoint is exercised.

## Status key

- **Connected** — frontend action has a persistent backend/API path in source.
- **Connected; live acceptance outstanding** — backend exists, but real browser/provider journey still needs verification.
- **Local-only / cosmetic** — action changes browser state, local storage or displays a toast; no server-side record.
- **Disabled / not implemented** — UI explicitly says unavailable or no backend service exists.
- **Static / synthetic data** — values or records are hard-coded, illustrative or generated locally; not account data.

## Critical findings requiring correction before production promotion

A first-pass read of the base action dispatcher suggested sign-out was local-only. Tracing the later action wrappers showed the connected path is correctly intercepted: it calls `POST /api/auth/logout`, resets local session state and reports whether server revocation was confirmed. Sign-out is therefore **connected in the current deployed source**; retain explicit tests for success and network-failure paths.

| ID | Area | Evidence / actual behaviour | Status | Required action |
|---|---|---|---|---|
| CR-01 | Portfolio Manager valuation | `PMD` hard-codes portfolio value $24,750.50, change +12.8%, balance $12,430.75, +5.2%, activity counts and document records. The page then derives a changing chart from live Binance BTC/ETH/SOL/BNB prices using fixed asset weights anchored to that hard-coded value. | Synthetic data presented as a portfolio | Remove or prominently label demo data. Do not present these as a user's holdings, balance, performance or investment history. Replace with an actual ledger/portfolio source only after product and data model are defined. |
| CR-02 | Portfolio documents | `PMD.docs` hard-codes agreement, identity and proof-of-address rows, including signed flags and dates. They are not loaded from the organization document API. | Static / synthetic | Replace with real authenticated document records or clearly label as sample preview. Never imply a user has signed or submitted a document unless persisted. |
| CR-03 | Account sign-in provider linking | `act.link` toggles `st.links` only. Telegram, X and Google controls do not perform OAuth or call a backend account-link route. | Local-only | Remove fake Linked state or implement OAuth state/nonce, callback, account binding and unlink lifecycle. |
| CR-04 | Advertising request | `act.advsend` validates only a local campaign title, shows “Request sent”, then navigates back. No request API exists in the API module. | Fake success / local-only | Do not show success until a persisted server request exists; otherwise show “not available”. |
| CR-05 | Promotions | `act.promo` toggles `st.open` and displays Joined/Left. No promotion participation route or record exists. | Local-only | Mark as preview or implement server-side eligibility, participation and audit records. |
| CR-06 | Referral / rewards / affiliate | Referral code is derived client-side from UID; referral stats and rewards are hard-coded zero. Rewards tasks/points are illustrative. Affiliate join toggles `st.joinedAff`; affiliate page says Coming soon. | Static / local-only | Do not show earned points, joined status or commissions as real. Implement attribution, qualification, ledger, abuse controls and settlement before launch. |
| CR-07 | Wallet and money movement | Wallet choices show “Wallet connection is not enabled yet”; crypto deposit is disabled; fiat deposit and transfer buttons show not connected. No wallet, deposit, withdrawal, transfer or custody ledger controller exists in the API module. | Disabled / not implemented | Keep disabled. Decide custody/non-custody model, supported networks, payment providers, compliance, ledger/reconciliation and controls before implementation. |
| CR-08 | KYC | Signed-in KYC submit explicitly says “Identity verification is not open yet”; no KYC submission controller/provider workflow exists. | Disabled / not implemented | Keep unavailable until a KYC provider and case lifecycle are integrated and accepted. |
| CR-09 | FX and MT5 feeds | The deployed app's central book client still uses Render. AWS feed has FX `not_configured`, 0 quotes and MT5 0 quotes; Render has 8 FX reference quotes but reports MT5 broadcast/permission flags true. | Still dependent on Render; AWS parity incomplete | Configure FX on AWS, resolve the MT5 flag discrepancy, validate WebSocket parity, then switch the app to AWS. Do not enable MT5 broadcast without written authorization. |
| CR-10 | NFT / OpenSea | Live `/api/nfts`, `/api/nft-collections` and `/api/nft-collection` requests all return HTTP 503 with `configured:false`: `OPENSEA_API_KEY` is absent from the deployed web service environment. | Provider disconnected | Configure the OpenSea key as a server-side secret in the deployed web runtime, then verify search, collection listing and item details. Never expose the key to browser code. |

## Other local-only, static or misleading interactions

| Feature / action | Current implementation | Status |
|---|---|---|
| Waitlist | Validates email format and displays “You are on the waiting list”; no API call. | Local-only fake confirmation |
| Newsletter / `wsub` | Displays a toast only. | No subscription backend |
| Affiliate community | Displays “Community chat opens in the app”. | Placeholder |
| Community social links | Display “Opens our … page” toast; no verified destination URL in handler. | Placeholder |
| App-store rating | Displays toast saying rating opens in app store. | Placeholder |
| B2B local sub-account fallback | `subadd` appends to `st.subs`; not a persistent sub-account. Connected organization screen is a separate real organization workflow. | Local-only in preview; not a real sub-account system |
| Profile avatar picker | `avatar` and `rmphoto` update local state; the screen explicitly says the photo is kept on this device in preview. | Device/local preview only; separate public-profile editor is server-backed |
| Public profile editor | `tlUpdateProfile` sends bio, Instagram/X handles, website, profile photo and cover photo to `PATCH /api/profiles/me` when connected. | Connected; browser acceptance and payload-size limits still need verification |
| Organization photo | Stored in localStorage under `tm.orgphoto.<id>`; not uploaded to organization backend. | Local-only |
| Organization photo | Saved in localStorage under `tm.orgphoto.<id>`; not uploaded to organization backend. | Local-only |
| Buyer/Seller mode | `mode` toggles local app state and local save; no server preference route is called for this switch. | Local-only preference |
| Legacy deal controls | `dealcancel` changes a local deal status and `dealadv` increments a local step; the server-backed contract lifecycle is a separate flow. | Local-only legacy interaction; do not confuse with contract status |
| Theme | Stored locally. | Expected device-only preference |
| Additional verification | UI is a future support-request description, not a case-management API. | Not implemented |
| TradeMate Card | Explicit Coming soon screen. | Not available |
| Fee rates | Values show “Not set”; terms are not configured. | Not configured |
| Help / FAQ | Static client content. Support ticket submission is separate and server-backed. | Static information |
| Portfolio Manager document download | Current document cards are static; no actual document bytes or authenticated download is wired from these cards. | Not implemented |
| Notifications in preview mode | Read-all/read-one may update local state when not connected. Connected path uses API. | Local fallback only |
| Support tickets/feedback in preview mode | Local fallback creates local ticket/feedback records when not connected. Connected path calls API. | Preview-only fallback; connected path exists |
| Nickname in preview mode | Saves to local state when not connected; connected path calls profile API. | Preview-only fallback |
| Account preferences | Supported preference fields call `PATCH /api/preferences`. | Connected |
| Two-factor/session/account deletion/logout | Real API calls exist in the UI, including the connected logout wrapper. | Connected; full browser acceptance outstanding |

## Server-backed workflows present in source

The current API includes controllers for:
- Health and database health.
- Authentication: register, current user, profile, 2FA, sessions, password change/reset, email verification, account deletion/cancellation and logout.
- Preferences and notifications.
- Support tickets, ticket messages and feedback.
- Organizations and organization documents.
- Marketplace listings, moderation and review.
- Enquiries and enquiry messages.
- Contracts, contract messages, responses, cancellation and completion.
- Market trades/activity.
- P2P ads, book, orders, payment-sent, receipt confirmation, cancellation and disputes.
- Public profiles, profile updates, follow/unfollow.
- Feed posts, attachments, comments, reactions, pinning, reshares, reports and announcements.
- Moderation queues.
- Sports-transfer profiles, mandates and opportunities.
- Market quote route.

The frontend directly calls 75 distinct literal API paths. The presence of a route is not proof that a visible button reaches it or that the deployed workflow passes a two-account test. In particular, sports-transfer API routes exist but were not established as fully surfaced/accepted UI journeys in this pass.

## Render dependency still present in the deployed market UI

A second migration check found that the market order-book client in the exact deployed `app.js` still calls `createFeedClient({ url: "wss://exchange-feed.onrender.com", ... })` inside `tmConnectCentral()`. The new AWS feed at `wss://feed.trademate.cfd` is not yet the configured source for that central aggregated order-book client.

Both services were healthy at the same audit time, but they are **not feature-equivalent**:

| Capability | Existing Render feed | New AWS feed |
|---|---|---|
| Readiness | 200, ready | 200, ready |
| Exchange providers | 5/5 live | 5/5 live |
| Books | 75 observed, 75 fresh, 0 stale | 75 observed, 75 fresh, 0 stale |
| FX | Available; Twelve Data Basic; 8 reference quotes | Not configured; 0 quotes |
| MT5 quotes | 0 | 0 |
| MT5 public-broadcast flag | true | false |
| MT5 redistribution-permission flag | true | false |

No endpoint switch was made. Changing the UI to AWS now would remove the FX reference quotes currently provided by Render. Also, the Render MT5 permission/broadcast flags conflict with the project’s conservative permission gate; although both services report zero MT5 quotes, the Render flag state must be investigated and broker authorization verified before any MT5 broadcast is allowed. Do not copy those flags to AWS.

**Migration action:** configure and verify the approved FX provider on AWS, resolve the MT5 permission-flag discrepancy, run the same WebSocket contract/freshness tests against AWS, then change `tmConnectCentral()` to `wss://feed.trademate.cfd` and verify live order books and FX in the browser before retiring Render.

## Backend routes that are not currently wired to the web runtime

A repository search of the deployed web runtime and Next.js app found no frontend calls for these API families. They are backend capabilities, not currently proven end-user workflows:

- **Sports Transfer:** no `/sports-transfer/*` call in the web runtime. The API has player/sports profiles, consents, organization membership, representative mandates and opportunity drafts. The Sports category tile is not proof those dedicated workflows are connected.
- **Moderation administration:** no web-runtime calls to `/moderation/reports`, organization/listing review queues or announcements. The backend moderation routes exist, but an operational moderator console/acceptance path was not found in this pass.
- **Organization member management:** backend member list, invite, accept and revoke endpoints exist, but the web runtime does not call the membership endpoints. Current organization UI supports create/update/documents; it does not provide the complete invitation and member-role workflow.
- **Sports profile self-service and consent controls:** the API supports private profile/consent operations, but no corresponding web calls were found.

The source contains 82 `data-act` marker occurrences (61 distinct values), 48 `data-pc` occurrences (38 distinct values), 75 `data-pg` occurrences (41 distinct values), 19 `data-f` occurrences (9 distinct values), plus a navigation tab marker. These counts describe literal source markers, not a claim that every generated or dynamic control has passed browser testing.

## Feed author relationship — resolved on AWS target

The concern that a feed post was not linked to its user was checked against the live AWS database and API:
- The only current AWS feed post has a non-null `author_user_id`.
- That ID resolves to an existing user row; display name is `Deukleinz`.
- Aggregate check: 1 post, 0 null author IDs, 0 orphaned author IDs.
- The public feed API returns that post successfully.
- No UPDATE/repair was performed because the ownership relationship is already valid.

The API's left join and fallback display label can mask missing display-name values in other records, so keep the orphan/null audit as a regression check. The current target row is linked correctly.

## Live service state at audit time

| Service / endpoint | Result | Interpretation |
|---|---|---|
| `https://api.trademate.cfd/api/health` | HTTP 200 | API process responding |
| `https://api.trademate.cfd/api/health/database` | HTTP 200, connected | Runtime DB connection works |
| `https://api.trademate.cfd/api/auth/me` without credentials | HTTP 401 | Expected unauthenticated response |
| `https://api.trademate.cfd/api/feed/posts?limit=40` | HTTP 200 | Feed API responding |
| `https://feed.trademate.cfd/health` | HTTP 200; 5/5 exchange feeds live; 75 books | Exchange service is live at sampled time |
| `/api/market/quotes?symbols=^GSPC,AAPL` | HTTP 200; valid quotes returned, both marked `delayed` with last market timestamps on 24 Nov | Quote integration is connected; not real-time at sampled time |
| `/api/market/activity?division=services` | HTTP 200; 14-day counts and current listing/enquiry/deal counts all zero | Real DB-backed activity endpoint; no qualifying Services activity in sampled window |
| `/api/market/highlights?division=services` | HTTP 200; all four slides null | Real DB-backed highlights endpoint; no qualifying records for the sampled division |
| Feed health MT5 | 0 quotes; public broadcast disabled | MT5 is not ingesting |
| Feed health FX (AWS) | `not_configured`, 0 instruments/quotes | FX provider is not configured |
| NFT search/collections/items routes | HTTP 503, `configured:false` | OpenSea API key is absent from the deployed web runtime |
| Existing Render feed `/ready` | HTTP 200; 5/5 feeds live; 75 fresh books; Twelve Data 8 FX quotes | Still serving the UI's central order-book client |
| New AWS feed `/ready` | HTTP 200; 5/5 feeds live; 75 fresh books; FX not configured | Healthy but not feature-equivalent to Render yet |
| `https://trademate.cfd/` and `/app` | HTTP 200 | Web app responds |

Note: `/health` at the API domain root (without `/api`) returns 404 by design because Nest uses global prefix `/api`. Do not use the root health URL as an API outage test.

## Full acceptance work still required

1. Fix CR-01 sign out before treating auth/session lifecycle as complete.
1. Remove or clearly label the Portfolio Manager synthetic valuation, balances, activity counts and sample documents.
2. Replace fake success states for waitlist, advertising, promotions, affiliate and newsletter with honest disabled states until their backend workflows exist.
3. Keep KYC, deposits, transfers, wallet and card disabled until their real providers/services exist.
4. Configure FX on AWS to match Render before switching the app feed; resolve the Render MT5 broadcast-flag discrepancy and do not enable public broadcast without written authorization.
5. Configure the OpenSea API key as a server-side secret and verify all three NFT endpoints. for authentication, profile, feed/media, notifications, support, organization, listings, enquiries, contracts and P2P, including refresh/re-entry, permission boundaries, retries and cross-account isolation.
6. Execute two-account browser acceptance for auth, profile, feed/media, notifications, support, organization, listings, enquiries, contracts and P2P, including refresh/re-entry, permissions, retries and cross-account isolation.\n7. Exercise every `data-act`, `data-pc`, `data-pg`, `data-f`, navigation tab and dynamic form control in the deployed app; verify each either has a persistent service action or is explicitly labeled local/preview/disabled.
8. Validate market quote symbols, freshness and stale-state behaviour. Do not infer a working Forex feed from crypto exchange-feed health.
9. Add automated regression checks for missing/orphaned feed authors and for UI handlers that display success without a persisted API response.

## Release guardrails

- Do not promote production, enable real-money functions, or claim KYC/wallet/FX/MT5 readiness based on UI presence or successful health endpoints.
- Do not modify existing feed ownership unless the audit finds a null or orphaned relationship and the correct owner can be proven.
- Keep local preview mode visibly distinct from a signed-in, server-backed account.
