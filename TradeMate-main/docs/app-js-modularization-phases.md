# app.js modularization phases

Branch: `refactor/split-web-app-runtime`

## Completed

### Phase 1 — independent runtime patches
- 41 standalone runtime modules extracted.
- Runtime order is preserved by `TradeMateRuntime.tsx`.
- `app.js` reduced from 705,335 to 684,937 characters (20,398 characters).
- CI and browser acceptance checks passed on the last verified head.

## Remaining phases

### Phase 2 — market data and NFT services (in progress)

**Additional completed extraction:** NFT and market-quote snapshot storage factories moved to `public/tm/snapshot-utils.js`. Existing localStorage key formats, payload shapes, chain scoping and cache expiry windows are preserved. Runtime startup now waits for this dependency before loading `app.js`.

**Completed:** extracted the FX reference-rate snapshot store into `public/tm/fx-snapshot-utils.js`. It receives the market item array through an explicit factory option and preserves the legacy localStorage key, payload, 14-day expiry and cached/live quote mutation rules. Runtime startup now verifies this module before `app.js` runs. The app cache version is now `v=156`.

**Completed:** extracted five pure quote helpers (`quoteTimestampMs`, `mt5SymbolKey`, `mt5QuoteIsFresh`, `mt5QuotePrice`, `mt5NameForQuote`) and their MT5 metadata constants into `public/tm/market-quote-utils.js`. The runtime loads this dependency before `app.js`; the legacy names are bound to the exported helpers to preserve existing call sites. `app.js` cache version is now `v=154`.

**Next safe boundaries:** audit NFT loading boundaries and market quote loading; the stateful feed managers remain coupled to socket/timer state. The latter remain coupled to socket/timer state and must not be extracted until a context interface is defined.

**Remaining targets:**
Target groups identified in the remaining `app.js`:
1. Market metadata refresh and FX snapshot helpers (`tmApplyFxRates`, `tmRestoreFxSnapshot`, `tmSaveFxSnapshot`, `liveRefresh`).
2. NFT snapshot and loading services (`nftSnap*`, `loadLiveNFTs`, `loadNFTCollections`, `loadNFTCollectionItems`, `loadNFTExploreItems`).
3. Market quote snapshot and loading services (`tmQuoteSnapshot*`, `loadMarketQuotes`).
4. Market-feed lifecycle and venue adapters (`clearMarketFeedTimers`, `closeMarketSocket`, `resetMarketLevels`, `stopMarketFeed`, `retryMarketFeed`, `activate*`, `openMarketFeed`, `ensureCryptoFeed`).
5. Central feed snapshots, multi-feed coordination and MT5/FX quote adapters (`tmSnapshot*`, `tmConnectCentral`, `ensureMultiFeeds`, `applyMt5MarketQuotes`, expiry and FX feed helpers).

**Estimated output:** 10–15 modules, subject to dependency audit. Do not split a function from state it mutates unless that state is moved behind an explicit context interface. Keep spot-price authority and feed sequencing unchanged.

### Phase 3 — trading and portfolio workflows
- Trade page and trade-core rendering.
- Activity, internal trades and P2P data workflows.
- Portfolio calculations, chart lifecycle and polling.
**Estimated output:** 8–12 modules.

### Phase 4 — social, feed and discovery
- Feed composer, media, timeline, profile and post actions.
- Scout/discovery presentation and data helpers.
- Marketplace browsing and service discovery.
**Estimated output:** 10–15 modules.

### Phase 5 — account, identity, wallet and deal workflows
- Account preferences, sessions, notifications and authentication-adjacent screens.
- Identity verification and wallet helpers.
- Enquiries, agreements, deal documents, chat and organisation workflows.
**Estimated output:** 12–18 modules.

### Phase 6 — shared UI primitives and final consolidation
- Navigation, page/sheet rendering, common form controls and shared presentation utilities.
- Replace remaining implicit global coupling with documented runtime context.
- Remove obsolete inline blocks only after parity and browser acceptance tests.
**Estimated output:** 8–12 modules plus final cleanup.

## Safety gates for every phase
1. Map reads/writes of shared state and all DOM, timer, socket and API side effects.
2. Extract only cohesive units with a stable interface; do not manufacture modules to meet a count.
3. Preserve classic-script execution order and global compatibility until callers are migrated.
4. Run syntax checks, production build, app-shell browser tests, account-isolation tests and relevant feature tests.
5. Verify the PR checks before starting the next phase. Do not merge or deploy as part of this refactor without explicit approval.

Counts are estimates, not a promise to split tightly coupled code. The first phase-2 audit may narrow or reorder these boundaries if the source proves more coupled than the initial scan suggests.