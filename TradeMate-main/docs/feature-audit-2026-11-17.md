# TradeMate feature audit — 17 November 2026

## Scope and method

This is a source-level audit of the current application baseline, not a claim that every workflow has been accepted in production. It reviews the main web runtime (`apps/web/public/tm/app.js`), API controllers in `apps/api/src/module.ts`, and the existing marketplace integration/CI evidence. The API module contains 91 decorated HTTP endpoints across the controllers listed below. A screen or button is not treated as implemented unless its action reaches a real service or persistent API.

The audit snapshot is based on main after PR #155 (merge commit `3a293d06ccf942c9373336d9215f4a589c92da25`). PR #156 subsequently corrected the profile verification progress indicator to reflect the actual three-step flow; it was merged as `ef8b3939dc1acdb2cdc96e1a743a5e61cfa320ac` after all eight CI jobs passed.

## Implemented server-backed workflows

| Area | Source evidence | Status / remaining acceptance |
|---|---|---|
| Ten Contract Categories | Explore renders a distinct **Contract categories** section. Listing API supports draft creation, own listings, submit-for-review, update/delete, detail and public browse. `division` remains separate from `listing_type`. | Shared draft → review → moderation → public discovery workflow exists for all ten categories. Owner/admin/member coverage includes rejection, privacy while rejected, resubmission and approval in PR #155. Category-specific specialist compliance and unique regulatory gates are not implied. Category-filter UI and production two-account acceptance remain. |
| Marketplaces navigation | Explore separately renders **Marketplaces** from Contract Categories; search filters use the two groups. | Structure is present. Continue browser acceptance of every tile, filter, back path and empty/error state. |
| Contracts | `market/contracts` supports create, mine, detail, seller response, cancellation, completion confirmation and messages. | Persistent contract lifecycle exists. Verify real two-account UI-to-API-to-PostgreSQL transitions, retries, unauthorized access and both Clients/Alpha modes. No payment, escrow or e-signature is implied. |
| Enquiries / Conversations | `market/enquiries` supports create, mine and messages. | Server-backed. Verify role-specific UI, message delivery and error recovery. |
| P2P | `p2p` supports order book/trades, ads, private ads/orders, order creation, payment-sent, receipt confirmation, cancellation and disputes. | Server-backed P2P lifecycle. It is separate from Contract Categories. Do not describe the flow as custodial escrow or integrated bank settlement without separate evidence. |
| Feed | `feed` supports posts, attachments, comments, reactions, pinning, reshares, reports, moderation reports and announcements. | Server-backed. Mobile camera/microphone permissions, upload/playback, large-file limits, offline recovery and failure states still need device QA. |
| Public profiles | `profiles` supports public profile reads, own-profile update and follow/unfollow. | Persistent profile/follow foundation exists. Live two-account profile/photo acceptance and object-storage migration remain. |
| Notifications | `notifications` supports listing, read-all and per-notification read. | Server-backed. Continue acceptance of action-link routing and unread-state consistency. |
| Support / feedback | `support` supports tickets, ticket messages and feedback. | Server-backed. Verify full ticket status transitions and attachments/notifications where applicable. |
| Organization | `organizations` supports create, own organization, update, document upload/listing and moderation review. | Organization and document workflows exist. Document permissions are role-limited. Current account model permits one organization per user; do not silently present the local “Create a B2B account” control as multi-organization support. |
| Authentication / account security | Auth routes cover registration, email verification, login, profile update, password change/reset, 2FA setup/confirm/disable/verify, session listing/revocation, logout and account deletion request/cancel. | Server-backed security workflows. Continue acceptance of email delivery, authenticator setup, session revocation and the deletion/cancellation window. |
| Preferences | Preferences API supports read/update; UI saves account language and preference settings. | Server-backed settings for supported fields. Theme and other device-only preferences should be described as local where applicable. |
| Forex quote foundation | Market quote API plus saved quote snapshots and Exness MT5 integration are present. | Quote foundation and restoration logic exist. Live provider availability, freshness/expiry, every instrument group and feed recovery need market acceptance. |
| Crypto spot | Explore is configured for Spot Markets; exchange-feed and market-feed client logic are present. | Spot quote plumbing exists. Verify instrument coverage, live updates, stale-data suppression and empty/error recovery. Crypto prices are reference data; do not imply TradeMate is executing spot trades. |
| NFT marketplace | Frontend uses NFT collection/item API paths and snapshot caching, with external OpenSea-backed data handling. | Integration exists in the client path. Verify mixed collection results, network filters, collection navigation, timeout/partial results and provider recovery. |

## Presentational, local-only, disabled or not-yet-open features

| Screen / feature | What the current source does | Correct status |
|---|---|---|
| Identity verification (KYC) | Three-step personal-details, identity-document and selfie UI. Signed-in submit explicitly shows “Identity verification is not open yet.” No KYC controller/API route exists. | **Not connected / not open.** Do not say users can submit KYC or that documents are reviewed. The form state is not a persistent KYC case. |
| Crypto deposits | Asset/network selector is shown, but address generation is disabled and the screen says “Not active yet.” | **Disabled.** No deposit-address or deposit-crediting service exists in the API module. |
| Fiat deposits | Deposit summary is displayed; action explicitly says fiat deposits are not connected. | **Not connected.** No payment-provider or deposit ledger route exists. |
| Transfers | TradeMate ID, bank and crypto transfer forms exist, but the action always reports transfers are not connected. | **Not connected.** No transfer/withdrawal/ledger API exists. |
| Wallet balances | Asset overview derives a contract-value summary; fiat/crypto balances show unavailable placeholders. | **Not a funded wallet or balance ledger.** Do not present contract totals as withdrawable balances. |
| Wallet connection | Wallet choices display but each action says wallet connection is not enabled. | **Disabled.** No wallet connection/signing service is present in the audited API module. |
| Withdrawal | No withdrawal action or withdrawal API is present in the audited UI/API. The only “withdrawn” text in the web runtime is ordinary legal wording about features being withdrawn. | **No withdrawal feature.** Do not add or imply one without an approved custody/payment design. |
| B2B sub-accounts | “Create a B2B account” appends a name to local `st.subs`; it does not call the organizations API. | **Local-only placeholder.** Separate organization/team management needs a product/data-model decision. |
| External account linking | Telegram, X and Google controls toggle `st.links` locally. | **Not OAuth-linked.** No account-linking API flow is present. |
| Referral | A code is generated in the client from the user's UID; invited-friend and reward counts are hard-coded zero. | **Share-code UI only.** No attribution, referral event or reward ledger endpoint is present. |
| Rewards | Rewards Hub shows zero points and four illustrative tasks. Reward details are explicitly forthcoming. | **Preview only.** No rewards ledger/qualification API exists. |
| Earn / affiliate | Earn cards link to referral/rewards/affiliate; affiliate programme is marked coming soon. | **Informational / coming soon.** No commission or affiliate settlement service exists. |
| Promotions | Join/leave toggles local UI state. | **Local preview.** No promotion participation API exists. |
| Advertise | Request form displays a success toast locally. | **Not submitted to a server workflow.** No advertising request API exists. |
| TradeMate Card | Explicit “Coming soon” screen. | **Not available.** |
| Fee rates | All displayed fee values are “Not set”; page says rates will be published before launch. | **Not configured.** Do not advertise a fee schedule. |
| Affiliate community / social links | Community links and “open community” controls show informational toasts. | **Navigation placeholders** until real destination URLs/integrations are configured. |
| Additional verification | Screen displays zero cases and describes a future support request. | **No self-service case workflow** evidenced. |
| Help articles | FAQ/help content is static in the client; ticket submission is server-backed separately. | **Static knowledge content + real support tickets.** Keep those statuses distinct. |

## API controller inventory

The audited NestJS API controllers are: health, auth, preferences, notifications, support, organizations, market/listings, market/enquiries, market/contracts, market/trades, P2P, profiles, feed, moderation and market/quotes. The module has no wallet/deposit/withdrawal/transfer, KYC submission, referral/rewards, promotion, affiliate, OAuth-linking or sub-account controller.

This inventory is scoped to `apps/api/src/module.ts`; NFT provider routes and exchange-feed services live outside that module and must be assessed separately.

## Recommended execution order

1. **Preserve and complete core trading acceptance:** live two-account UI/API/database acceptance for all ten Contract Categories, Contracts, Conversations, P2P and organization permissions. Include unauthorized access, concurrency, rejection/resubmission, retry and persistence.
2. **Fix high-trust workflow gaps before promoting them:** decide and implement a real KYC provider/case lifecycle before showing “submit for review” to signed-in users. Until then, keep the explicit not-open state.
3. **Make the wallet product decision before implementation:** choose custody/non-custody model, supported assets/networks, payment rails, ledger, reconciliation, compliance and risk controls. Deposit, transfer and withdrawal must remain disabled until this exists.
4. **Resolve organization model:** decide whether one user may own/join multiple organizations and whether B2B sub-accounts are distinct organizations, teams or workspaces. Replace the local-only sub-account control only after that model is approved.
5. **Connect growth features:** referral attribution, rewards qualification/ledger, promotions, advertising requests and affiliate commissions need server-side records, eligibility rules and abuse controls before counters or success states imply real participation.
6. **Complete marketplace and device acceptance:** Forex/MT5 freshness, Crypto spot feed recovery, NFT provider errors, category filters, Feed media capture/playback, notification action links, responsive layouts and accessibility.
7. **Keep release evidence separate:** CI passing proves the tested code paths; it does not prove live provider availability, real KYC review, payment settlement or production user acceptance. Verify Render deployment status independently for every production release.

## Important product-scope guardrails

- Explore remains split between Contract Categories and Marketplaces.
- All ten Contract Categories share the review workflow; Services and B2B are not the only categories eligible for review.
- P2P remains a separate marketplace workflow.
- No conventional product-cart checkout should silently reappear.
- No withdrawal option should be introduced as a cosmetic UI control without the corresponding wallet ledger, payment/custody design, controls and API.
