# app.js modularization phases

Branch: `refactor/split-web-app-runtime`

## Completed

### Phase 1 — independent runtime patches
- 41 standalone runtime modules extracted.
- Runtime order is preserved by `TradeMateRuntime.tsx`.
- `app.js` currently contains 596,386 characters, down 108,949 characters from the 705,335-character baseline.
- CI and browser acceptance checks passed on the last verified head.

## Remaining phases

### Phase 2 — market data and NFT services (in progress)

**Additional completed extraction:** NFT and market-quote snapshot storage factories moved to `public/tm/snapshot-utils.js`. Existing localStorage key formats, payload shapes, chain scoping and cache expiry windows are preserved. Runtime startup now waits for this dependency before loading `app.js`.

**Completed:** extracted the FX reference-rate snapshot store into `public/tm/fx-snapshot-utils.js`. It receives the market item array through an explicit factory option and preserves the legacy localStorage key, payload, 14-day expiry and cached/live quote mutation rules. Runtime startup now verifies this module before `app.js` runs. The app cache version is now `v=158`.

**Completed:** extracted five pure quote helpers (`quoteTimestampMs`, `mt5SymbolKey`, `mt5QuoteIsFresh`, `mt5QuotePrice`, `mt5NameForQuote`) and their MT5 metadata constants into `public/tm/market-quote-utils.js`. The runtime loads this dependency before `app.js`; the legacy names are bound to the exported helpers to preserve existing call sites. `app.js` cache version is now `v=157`.

**Completed:** extracted the pure NFT collection-result interleaving algorithm into `public/tm/nft-item-utils.js` and reused it in both NFT explore merge passes. This removes duplicate ordering loops while preserving the round-robin ordering of collection results. The same edit corrected a malformed `returnwindow` token in the collection fetch normalizer call. The NFT utility cache is `v=2`; app runtime cache is `v=158`.

**Completed:** moved NFT result sorting (price and 24-hour sales, including the existing missing-value fallbacks) and NFT favorite-key generation into the pure NFT utility module. The renderer now calls these shared helpers without changing the sorting defaults or favorite key format. NFT utility cache is `v=3`; app runtime cache is `v=159`.

**Completed:** extracted the market-quote candidate filter and deterministic request-key builder into `public/tm/market-quote-utils.js`. The filter retains the Twelve Data exclusion and fresh Exness MT5 quote bypass; the key retains the exact `assetClass:symbol,symbol` format used by both request de-duplication and follow-up refresh checks. Market utility cache is `v=2`; app runtime cache is `v=160`.


**Completed:** extracted ten pure decorative SVG/coin/globe renderers (`prmArt`, `dpArt`, `dxArt`, `tfArt`, `tfCoin`, `cxArt`, `scoutArt`, `scoutGlobe`, `dxCoin`, `dpCoin`) into `public/tm/art-utils.js`. The module has no app-state, network, timer or DOM dependencies; `TradeMateRuntime.tsx` verifies it is initialized before loading `app.js`. The app cache is now `v=162`.

**Next safe boundaries:** extract cohesive NFT request orchestration and market quote loading behind explicit context objects. Their request counters, chain selection, caches, UI refreshes and retry timers must move together; do not extract individual callbacks or functions while leaving their mutable state behind. The Binance/Bybit/Coinbase exchange-feed lifecycle has now been extracted behind an explicit context factory; central multi-feed coordination and MT5/FX adapters remain separate, stateful targets.

**Remaining targets:**
Target groups identified in the remaining `app.js`:
1. Market metadata refresh and FX snapshot helpers (`tmApplyFxRates`, `tmRestoreFxSnapshot`, `tmSaveFxSnapshot`, `liveRefresh`).
2. NFT snapshot and loading services (`nftSnap*`, `loadLiveNFTs`, `loadNFTCollections`, `loadNFTCollectionItems`, `loadNFTExploreItems`).
3. Market quote snapshot and loading services (`tmQuoteSnapshot*`, `loadMarketQuotes`).
4. Central multi-feed coordination and MT5/FX quote adapters (`tmSnapshot*`, `tmConnectCentral`, `ensureMultiFeeds`, `applyMt5MarketQuotes`, expiry and FX feed helpers); the standalone exchange-feed lifecycle is now extracted.
5. Central feed snapshots, multi-feed coordination and MT5/FX quote adapters (`tmSnapshot*`, `tmConnectCentral`, `ensureMultiFeeds`, `applyMt5MarketQuotes`, expiry and FX feed helpers).

**Estimated output:** up to 90 modules per accelerated batch, subject to dependency audit and safe boundaries. Do not split a function from state it mutates unless that state is moved behind an explicit context interface. Keep spot-price authority and feed sequencing unchanged.

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

**Completed:** extracted the three pure shared formatting helpers (`esc`, `fmt`, `fx2`) into `public/tm/format-utils.js`. `TradeMateRuntime.tsx` verifies the module is initialized before `app.js` loads; legacy call sites retain the same helper names and formatting behavior. The app cache is now `v=163`.


**Completed:** extracted the pure marketplace API-to-view mappers (`mapListing`, `dealFromEnq`, `contractStatusLabel`) into `marketplace-mappers.js`. The module receives formatting helpers and lookup tables explicitly; legacy call sites keep their names. `TradeMateRuntime.tsx` now verifies the module before allowing `app.js` to start. App cache advanced to `v=164`.


**Completed:** extracted the 23,184-character Scout stylesheet installer into `public/tm/scout-styles.js`. The extracted module receives the existing `SCMAP` asset URL explicitly, preserves the `scStyles` duplicate-injection guard, and is loaded and initialization-checked by `TradeMateRuntime.tsx` before `app.js`. The legacy `scoutCss()` call sites remain intact; app cache is now `v=165`.


**Completed:** extracted the `markets()` and `tradeCore()` renderers (11,213 source characters) into `public/tm/market-ui.js`. Their shared runtime values and callbacks are injected at call time; the legacy function signatures remain as delegates. `TradeMateRuntime.tsx` now loads and validates the module before app startup. App cache is `v=166`.


**Completed:** extracted 22 contract, agreement and conversation UI renderers/helpers (13,162 source characters) into `public/tm/contract-ui.js`. A lazy factory receives the legacy runtime dependencies once, and the original function signatures remain as delegates. Runtime startup validates the module before loading `app.js`; app cache is `v=167`.


**Completed:** extracted 14,693 characters of static marketplace, home-screen and theme configuration into `public/tm/market-config.js`. The module has no app-state or DOM dependencies; it exports the existing constants, market seed items, home-navigation helpers and theme definitions through a runtime-validated configuration object. `app.js` binds the original names before use. Runtime startup waits for the module; app cache advanced to `v=168`. Net `app.js` reduction: 14,069 characters.

**Completed:** extracted the stateful exchange market-feed lifecycle (socket ownership, venue failover, retry/recovery timers, and throttled redraw scheduling) into `public/tm/market-feed-manager.js`. The module receives `items`, `st` and `softDraw` through an explicit factory context; the legacy `scheduleMarketDraw` call sites remain bound to the returned function. The runtime validates the factory before starting `app.js`. Net `app.js` reduction: 10,692 characters; cache advanced to `v=169`.

**Completed:** extracted the static base application stylesheet payload and Scout shadow-root template into `public/tm/app-shell-assets.js`. Both assets are literal-only strings with no app-state or DOM dependencies; their evaluated contents were compared against the pre-extraction source and match exactly. `TradeMateRuntime.tsx` now loads and validates the asset module before `app.js`; app cache advanced to `v=170`. Net `app.js` reduction: 111,337 characters.
