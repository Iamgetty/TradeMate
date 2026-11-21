# Legacy runtime page-module contract

Status: design baseline for issue #149. This document does not claim that any page is independently lazy-loadable yet.

## Why Pick is first

The current runtime registers `PG.pick` inside the private `app.js` IIFE. The renderer reads shared runtime state and services directly:

- `CONNECTED`: whether the runtime is in connected/API mode.
- `items`: current marketplace listing collection.
- `st`: selected offer and page state (`cfSel`, `cfOpen`, and related state).
- `byName`: resolves the selected listing.
- `cfProposal`: shared contract-proposal renderer/service.

This is a useful first boundary because it is narrower than Deal, P2P, or Scout. It is not yet a standalone module: extracting only the function body would leave implicit closure dependencies.

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
5. If the module is unavailable or its contract is invalid, startup fails with a useful diagnostic; do not silently render an empty page.
6. The module is loaded before the runtime registers page renderers. First-use loading must not be attempted until this contract is tested.

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
