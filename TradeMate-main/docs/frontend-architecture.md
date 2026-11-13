# Frontend architecture and ownership boundaries

## Current runtime shape

TradeMate currently has a Next.js/React web shell around a substantial legacy JavaScript application runtime. This is a deliberate transition architecture, not two equivalent application implementations.

```text
Browser
  └─ Next.js app
      ├─ app/layout.tsx              document metadata and global CSS
      ├─ app/page.tsx                redirects / to /app
      └─ app/app/page.tsx            mounts TradeMateRuntime
          └─ TradeMateRuntime.tsx    boot diagnostics + script/config boundary
              ├─ /tm/feed-client.js  optional market-feed data helper (no UI)
              └─ /tm/app.js          current application UI, navigation and state
                  ├─ desktop.css     desktop web presentation
                  └─ mobileweb.css   mobile/narrow web presentation
```

The Next.js route does not load `public/tm/index.html`; `/app` mounts the React runtime component directly. The standalone HTML file redirects to `/app` and is not a second supported app entry point.

## Ownership by layer

| Layer | Owns today | Must not duplicate |
|---|---|---|
| Next.js App Router | URL routing, document metadata, global CSS, server-side API proxy routes and the `/app` mount | Marketplace screens, account state or a second navigation system while the legacy runtime owns them |
| `TradeMateRuntime.tsx` | Sets `window.TM_CONFIG`, loads the runtime scripts once, detects startup failures and shows a recovery screen | Feature/business logic, API domain workflows or page-specific state |
| `public/tm/app.js` | Current user-facing app shell, feature screens, navigation, local UI state, API calls and responsive shell behaviour | A second React implementation of existing features without a planned migration |
| `public/tm/feed-client.js` | WebSocket connection/reconnection and normalization of exchange-feed data for the app | UI, styling, account/session state or direct ownership of marketplace screens |
| `public/tm/desktop.css` | Desktop web layout and presentation | Business logic or markup ownership |
| `public/tm/mobileweb.css` | Mobile and narrow-web layout, drawer and responsive presentation | Business logic or a separate feature implementation |

## API and session boundary

- The web app calls the NestJS API through the same-origin `/api/*` path and the Next.js proxy. Do not add a second browser API origin or bypass the established proxy without a documented architecture change.
- Authentication is server-backed. The browser uses the HTTP-only session cookie; JavaScript must not persist session tokens in localStorage or other script-readable storage.
- The Next.js shell owns the proxy/configuration boundary; the legacy app owns the current feature-level API client and screens. Keep those responsibilities explicit until a feature is deliberately migrated.
- `feed-client.js` is an optional data helper. Failure to load it must not prevent the core app from rendering.

## Responsive behaviour

- The legacy runtime detects native/standalone, mobile-web and desktop environments using user-agent and touch/standalone signals, then sets `tm-app`, `tm-mw` or `tm-desktop` on the document element.
- In mobile-web mode it loads `mobileweb.css` and creates the mobile top bar/drawer behaviour.
- In desktop mode it loads `desktop.css`; it also registers `mobileweb.css` behind the `(max-width:899px)` media query for narrow desktop windows.
- Native/standalone mode skips the web-specific responsive stylesheets.
- A narrow viewport in a desktop browser is not equivalent to a mobile user-agent context. Browser tests must cover both viewport responsiveness and the actual mobile-web runtime branch.

## Change rules

1. Search both the Next.js app and legacy runtime for existing screens, handlers, state and API calls before adding a feature.
2. Keep one source of truth for each feature. Do not implement the same workflow independently in React and `app.js`.
3. For an incremental migration, define the feature boundary, API contract, state ownership, navigation hand-off and rollback path first.
4. Move one feature at a time. Require parity for permissions, loading/empty/error/retry states, accessibility, responsive layouts and analytics/audit behaviour before retiring the legacy implementation.
5. Do not alter the `/app` boot sequence, script versions, runtime DOM ownership or global config as part of an unrelated UI change.
6. Keep runtime diagnostics limited to startup failures. Avoid broad global error handling that could turn an unrelated asynchronous page error into a full-screen startup failure.
7. Test the Next.js route, desktop browser context, real mobile user-agent context, optional feed-helper failure and API-unavailable behaviour. Authenticated feature tests must use isolated test fixtures, never a live production API.
8. Do not wholesale-rewrite the legacy app or remove the legacy entry assets until feature parity and production acceptance are demonstrated.

## Current test coverage and gaps

`apps/web/e2e/app-shell.spec.ts` covers root redirect, public landing, desktop/mobile app-shell startup and the optional feed-helper failure path. The API is stubbed to return 503 so the browser suite cannot mutate or authenticate against a live service.

`apps/web/scripts/test-account-isolation.js` statically checks connected-mode cache allowlisting, session bootstrap failure behaviour, request-generation isolation, account-switch cleanup, logout handling and server-side email verification wiring.

These tests do not replace authenticated two-account end-to-end acceptance against an isolated API/database fixture. Feature-level migration and parity work must add that coverage before changing ownership.

## Audit observations

- `app.js` remains the primary application implementation and is very large; splitting it should begin with inventory and dependency mapping, not moving arbitrary code into React components.
- The current Playwright mobile smoke test previously changed only the viewport while retaining a desktop user agent. It therefore did not exercise `TMENV.mw`; the revised test uses an iPhone browser context.
- The app integration guide must be kept in sync with auth lifecycle changes, including email verification, and should link back to this ownership document.
