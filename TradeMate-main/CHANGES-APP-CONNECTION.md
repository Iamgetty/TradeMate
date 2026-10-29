# Changes made when connecting the app

## Added
- `apps/web/public/tm/app.js` and `index.html`: the app, served at `/app`.
- `docs/app-integration.md`: what is connected, what is not, how to run.

## Fixed
1. **Search, filters and pagination never worked on the home page.** `apps/web/app/api/[...path]/route.ts` dropped the query string. It is now forwarded.
2. **Marketplace search crashed the API.** In `apps/api/src/module.ts` the ILIKE placeholders were missing `$` (`ILIKE 1`). Now `ILIKE $1`.
3. **Logout cookie options** did not match the options used to set the cookie in production. They now match.
4. **Offer status colour**: `pending_review` had no style on the My Offers page. Added.

## Changed (minimal)
- `apps/web/next.config.mjs`: rewrites `/app` to the app.
- `apps/web/app/page.tsx`: one "Open app" link in the nav.

Nothing else was touched: no migrations, no schema, no existing page logic.

## Token logos and startup (later update)
- `apps/web/public/tm/app.js`: 22 token logos (BTC, ETH, USDT, USDC, BNB, SOL, XRP, DOGE, ADA, TRX, AVAX, DOT, LINK, POL, LTC, BCH, XLM, ATOM, NEAR, UNI, SHIB, DAI, ETC) are embedded in the `EMB` object, so they work offline. TON is still loaded from the icon CDN or shown as a letter badge until its logo is supplied.
- Live CoinGecko refresh no longer overwrites embedded logos.
- Fallback badge colours added for the new tokens; a USDC/USDT row added to Markets.
- Startup flash fixed: the page stays hidden until the sign-in check finishes (`tmboot` style in `index.html`, released by `tmReveal()`; 6 s failsafe).
- `index.html` now loads `app.js?v=3` to bypass stale browser caches.
- Nothing in the API, migrations or schema was changed.
