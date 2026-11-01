# TradeMate pre-P2P functionality audit

Audit date: 2026-11-01  
Baseline: GitHub `main` at `4a96298927f5c0e4066247792f21f29e85897b49`  
Scope: source-level audit of the active Next.js runtime, browser bundle, Nest API controllers, database migrations and CI/deployment configuration.

## Source of truth and deployment

- The active application source is under `TradeMate-main/apps/`.
- The repository CI workflow builds `TradeMate-main/apps/api` and `TradeMate-main/apps/web`; Render's blueprint also sets those directories as the API and web service roots.
- There is a second top-level `apps/` tree. It is not used by the current CI workflow or the checked-in Render blueprint. Treat it as a stale/duplicate tree unless another deployment is explicitly found to use it. Do not patch it instead of `TradeMate-main/apps/`.
- The current `main` head has a successful CI run covering API TypeScript build, clean PostgreSQL migrations and web build/runtime syntax. This is build coverage, not live end-to-end QA.

## Confirmed fixes on this audit branch

- Added authenticated `PATCH /api/organizations/:id` for owner/admin organization-name updates, with validation and an audit event. The existing UI already called this route, but the API did not implement it.
- Added authenticated `PATCH /api/auth/password`. It verifies the current password, enforces the same 12-character minimum as registration, rejects reuse of the current password, updates the scrypt hash and revokes the user's other sessions.
- Changed the password form to use masked password inputs and connected its submit action to the new API route.
- Made Feed post titles optional at the API, matching the composer label and its existing submit payload. The body remains required.
- Made organization-document uploads transactional, so a failed multi-file upload rolls back instead of leaving a partial set of documents. Added UUID validation to the document-list route.
- Changed live logout to wait for the server response before clearing the local session. A failed logout now reports the error rather than silently discarding the local session.
- Changed session restoration so only an actual HTTP 401 clears the local session. A temporary network/API failure no longer silently signs the user out.
- Bumped the runtime asset query version after changing the browser bundle.
- Updated the API integration notes for the new routes and the actual database-health path.

## Backend-connected flows found in the active app

These have matching frontend requests and backend routes in the current source. They still need live end-to-end testing with real accounts and production services.

- Email/password registration, login, session lookup and logout.
- Organization creation, lookup, document upload/listing and (on this branch) profile-name editing.
- Services/B2B listing discovery, draft creation, submission for review, editing and deletion.
- Pre-contract enquiries and conversation messages.
- Marketplace contracts: proposal, response, cancellation, completion confirmation and contract messages.
- Feed post retrieval/creation, attachments, comments and reports.
- Read-only marketplace activity and completed-trade history.
- P2P book, trades, ads, orders and order-state actions have API routes in the current code. This audit does not start or advance the P2P roadmap; the presence of routes is not proof of escrow, wallet or payment-provider integration.

## Visible actions that are not account/backend connected yet

### Account, identity and social profile

- Profile nickname, bio, Instagram handle, X handle and website edits are saved in browser storage only.
- Profile avatar and cover-photo changes are saved locally only.
- Follow/unfollow and follower/following counts are local placeholders.
- Profile highlights: create, add cover, pin a Feed post, view and remove are local-only.
- Organization profile photo is stored locally; there is no organization-image upload route.
- Account linking for Telegram, X and Google only toggles local flags; no OAuth/link-account flow is connected.
- The avatar picker/photo upload and profile nickname editor do not persist to the user record.
- Two-factor authentication and login-alert switches are local preferences. Device history is explicitly sample data.
- Forgot-password action has no reset endpoint.
- Social sign-in action has no provider integration.
- Email-code resend is a preview-only action. Live sign-in currently uses email and password; mobile sign-in is explicitly unavailable.
- Identity-verification/KYC Continue action is not open; it returns an unavailable message.

### Support, feedback and notifications

- Support ticket creation and ticket replies are stored in local state/device storage. The UI itself says support messaging is not connected.
- Feedback Hub submissions are stored locally; there is no feedback-submission API.
- Notification list/read/unread and “mark all read” use local sample state; there is no notification API or server delivery/persistence in this app.
- Feed comments and Feed reports are backend-connected; they are separate from Support tickets and Feedback Hub.

### Wallet and money movement

- Portfolio balances are not connected to a wallet/ledger.
- Fiat deposit details are not connected.
- Crypto deposit address generation is disabled.
- Withdrawals are not connected.
- Internal transfers are not connected.
- Wallet-provider connection buttons (MetaMask, WalletConnect, Trust Wallet, Coinbase Wallet, Phantom and other wallet) are placeholders.
- These screens must not imply that funds are held, credited or moved by TradeMate. The balance visibility switch only hides/shows placeholder values; it does not query a ledger.

### Business growth and monetization

- Promotion “Join” buttons only toggle local state; no promotion enrolment endpoint exists.
- Advertise placement requests only show a local confirmation toast; no campaign-request endpoint exists.
- Referral code copy/share works as a device action, but the code is generated client-side and referral attribution, invited-user counts and reward balances are not server-backed.
- Rewards Hub points/tasks, Alpha level progress and fee rates are static placeholders; they are not calculated from verified account activity.
- Social community buttons (Telegram, X, WhatsApp, Instagram) and the affiliate-community button show placeholder toasts rather than opening configured destinations or a connected community.
- Affiliate programme and TradeMate Card pages are explicitly marked “Coming soon”; they are not connected products.
- Promotion enrolment only toggles local state; Advertise placement requests show a local confirmation toast without creating a server-side campaign request.
- The offline-preview B2B sub-account/team-creation screen stores local names only. The connected app instead shows the backend-backed Organization profile; no team-member invitation/role-management workflow is exposed.

### Marketplace coverage and execution

- Real Estate and Software Add Contract drafts are saved on the device only. Public publishing is currently connected for Services and B2B.
- Crypto and Forex pages provide reference/market data only; TradeMate does not execute ordinary crypto or FX buy/sell orders through those screens.
- NFT discovery is read-only/reference-oriented; direct NFT purchases are not processed by TradeMate.

### Device-only preferences

These currently persist on the device, not in the account: theme, language, display currency, default market, Buyer/Seller mode, home shortcuts/recent items, balance visibility, notification preferences and favorites/watchlist. Some are reasonable device preferences; favorites/watchlist and notification preferences may be better as account-synced features if cross-device continuity is required. The Learn guides and Announcements are also hard-coded in the frontend rather than loaded from a content-management API.

## Follow-up work queue (before roadmap progression)

1. Complete live end-to-end tests for the backend-connected flows and the fixes in this branch.
2. Build proper backend modules for Support tickets/replies, Feedback Hub, account profile fields/photos, follows/highlights, notification delivery/read state, and account linking.
3. Decide the security design and provider integrations for KYC, password reset, 2FA and login alerts.
4. Decide wallet/ledger custody model and provider integrations before exposing deposit, withdrawal, transfer or wallet-connect actions.
5. Build server-side promotion enrolment, campaign requests and referral attribution before showing success states.
6. Decide whether device preferences remain local or selected settings/watchlists sync to the account.
7. Keep P2P roadmap work paused until these pre-roadmap items are reviewed and prioritized.

## Additional confirmed reliability issue still to fix

- Several connected data loaders (`loadMarket`, `loadMine`, `loadOrg`, `loadContracts`, `loadContractMessages`, `loadEnquiries` and `loadMsgs`) swallow request failures. This can make a temporary API outage look like an empty marketplace, organization, contract list or conversation. Add explicit loading/error states and retry actions rather than silently returning empty data.

## Audit limitations

This is a source/API/configuration audit plus CI validation. It is not yet a browser-driven test of every screen, every role, every breakpoint, or live Render/production database behaviour. Any item described as backend-connected still needs authenticated end-to-end testing against a deployed API.
