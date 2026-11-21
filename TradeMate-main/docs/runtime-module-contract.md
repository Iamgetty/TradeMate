# Legacy runtime page-module contract

Status: design baseline for issue #149. This document does not claim that any page is independently lazy-loadable yet.

## First boundary: Pick; second boundary: P2P

The current runtime registers `PG.pick` inside the private `app.js` IIFE. The renderer reads shared runtime state and services directly:

- `CONNECTED`: whether the runtime is in connected/API mode.
- `items`: current marketplace listing collection.
- `st`: selected offer and page state (`cfSel`, `cfOpen`, and related state).
- `byName`: resolves the selected listing.
- `cfProposal`: shared contract-proposal renderer/service.

Pick was selected as the narrowest first boundary. P2P is now the second boundary; its rendering path also depends on shared cache and formatting services, so it receives those through an explicit contract. Deal and Scout remain in the monolith. Extracting only either function body would leave implicit closure dependencies.

## Proposed explicit contract

The page module should receive a dependency object, not reach into globals or split/evaluate source strings.

```ts
type PickPageDependencies = {
  isConnected: () => boolean;
  getItems: () => Array<{ srv?: boolean; [key: string]: unknown }>;
  getSelectedOffer: () => unknown;
  resolveOffer: (selected: unknown) => { srv?: boolean } | null;
  renderProposal: (
    offer: { srv?: boolean } | null,
    pageMode: true,
    eligibleOffers: Array<{ srv?: boolean; [key: string]: unknown }>
  ) => string;
};

type PickPageModule = {
  render: () => string;
};
```

The getters are deliberate: the runtime owns mutable state, and the page must observe the latest state on every render rather than a stale snapshot captured at module initialization.

## Required invariants

1. Rendering is synchronous and returns the same markup as the existing `PG.pick` implementation for equivalent state.
2. The module does not mutate runtime state while rendering.
3. Selection changes remain owned by existing `PC.cftoggle`, `PC.cfpick`, `PC.cfnone`, and `PC.cfbrowse` handlers.
4. No new global state, `eval`, string splitting, or source-code execution.
5. If the module is unavailable, the existing inline Pick renderer remains the compatibility fallback; this preserves behavior during the post-app script fetch and on asset failure.
6. The module is appended to the post-app script queue after `app.js` loads. It is therefore a separate runtime file, but it is not first-navigation lazy-loaded and may not be available for the earliest Pick render. The inline fallback covers that window.
7. The module contract is tested independently; full renderer parity and navigation/back-stack acceptance remain required before removing the fallback or introducing first-use loading.

## Acceptance tests before extraction

- Connected mode with a selected eligible offer renders that offer.
- Connected mode with no selected eligible offer chooses the first eligible service offer.
- Disconnected mode renders the existing sign-in/choose-offer empty state.
- A state change between renders is reflected (no stale captured state).
- Existing selection, browse, back-stack, and navigation handlers continue to work.
- Browser acceptance passes on desktop and mobile contexts.

## Migration order

1. Prove the Pick contract and tests.
2. Assess Market Category (it delegates to shared `markets(true)` and may not be a useful independent chunk yet).
3. Map Deal's shared conversation state and handlers before extraction.
4. Map P2P's data-loading and event dependencies.
5. Map Scout's phase/state and asynchronous data dependencies.
6. Add first-navigation loading only after each page has an explicit, tested module boundary.

## CSS extraction guardrail

The runtime currently has both extracted stylesheet assets and styles inserted dynamically by the IIFE. A style block is eligible for extraction only after confirming it is static and that its original insertion point, media conditions, theme behavior, and feature activation timing are preserved. Conditional, theme-specific, and feature-on-demand styles remain dynamic unless browser tests prove an equivalent replacement.

## Initial injected-style audit (app.js at this revision)

The first source scan found three runtime `createElement("style")` sites. None is safe to bulk-extract as-is:

1. The early app style element is assembled from multiple CSS string groups and a theme-dependent token block. Its content and cascade placement are coupled to runtime initialization; keep it dynamic until the groups are separated and light/dark plus responsive parity is proven.
2. The environment stylesheet helper copies an embedded style element when present, otherwise it inserts desktop/mobile stylesheet links and applies a media condition for mobile-web CSS. Preserve this environment branch and media behavior; do not replace it with an unconditional link.
3. The auth-gate style is inserted only when `CONNECTED` is true and removed by `releaseAuthGate()`. It is state/feature conditional and must remain dynamic.

This scan is limited to style-element creation. It does not classify every inline `style` attribute or stylesheets loaded by page-specific modules. The existing external runtime CSS assets should be audited separately for duplicate rules and exact insertion order before any further extraction.

## Second page boundary: P2P

The P2P page now has a standalone `TM_P2P_PAGE_MODULE` with an explicit dependency contract for live state, the P2P cache, loading, header rendering, formatting, escaping, empty-state rendering, and icons. The legacy renderer remains as a fallback if the module asset is unavailable. The module is queued after app bootstrap, not loaded on first navigation; the fallback preserves the first-render window and asset-failure behavior.

The module retains the existing buy/sell direction mapping, amount-range filter, loading/error/empty states, offer data attributes, payment-method display, and database-source notice. A browser contract test covers offer filtering and re-rendering from changed live state. Full end-to-end P2P interaction and authenticated API acceptance still need to be exercised before removing the fallback.
