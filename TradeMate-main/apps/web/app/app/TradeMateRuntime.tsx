'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    TM_ART_UTILS?: { prmArt: () => string; dpArt: () => string; dxArt: () => string; tfArt: () => string; tfCoin: () => string; cxArt: () => string; scoutArt: (...args: any[]) => string; scoutGlobe: (...args: any[]) => string; dxCoin: (...args: any[]) => string; dpCoin: (...args: any[]) => string };
    TM_FX_SNAPSHOT_UTILS?: {
      createFxSnapshotStore: (options: { items: Array<Record<string, any>> }) => {
        apply: (rates: Record<string, number>, mode?: string, timestamp?: string, savedAt?: number) => boolean;
        restore: () => boolean;
        save: (payload: { rates?: Record<string, number>; time_last_update_utc?: string }) => void;
      };
    };
    TM_SNAPSHOT_UTILS?: {
      createNftSnapshotStore: (options: { prefix: string; getChain: () => string }) => {
        key: (term: string) => string;
        save: (term: string, items: unknown[]) => void;
        load: (term: string) => unknown[] | null;
      };
      createMarketQuoteSnapshotStore: (options: { prefix: string; items: Array<Record<string, any>> }) => {
        key: (item: Record<string, any>) => string;
        save: (item: Record<string, any>, quote: Record<string, any>) => void;
        restore: (item: Record<string, any>) => boolean;
        restoreAll: () => void;
      };
    };
    TM_NFT_ITEM_UTILS?: {
      normalizeItems: (items: unknown[], chain: string, color?: string) => Array<Record<string, any>>;
      interleaveItems: (groups: Array<Array<Record<string, any>>>) => Array<Record<string, any>>;
      sortItems: (items: Array<Record<string, any>>, sort: string) => Array<Record<string, any>>;
      favoriteKey: (item: Record<string, any>) => string;
    };
    TM_MARKET_QUOTE_UTILS?: {
      MT5_PUBLIC_QUOTE_MAX_AGE_MS: number;
      MT5_CATEGORY_BY_TYPE: Record<string, string>;
      MT5_DISPLAY_NAMES: Record<string, string>;
      quoteTimestampMs: (value: unknown) => number;
      mt5SymbolKey: (value: unknown) => string;
      mt5QuoteIsFresh: (value: unknown) => boolean;
      mt5QuotePrice: (value: unknown) => number | null;
      mt5NameForQuote: (value: unknown) => string;
      selectMarketQuoteItems: (items: Array<Record<string, any>>, assetClass: string, isMt5QuoteFresh: (item: Record<string, any>) => boolean) => Array<Record<string, any>>;
      marketQuoteRequestKey: (assetClass: string, items: Array<Record<string, any>>) => string;
    };
    __tradeMateBooted?: boolean;
    tmMarketMetadataStatus?: {
      state: 'fresh' | 'stale' | 'unavailable';
      lastAttemptAt: number | null;
      lastSuccessAt: number | null;
      error: string | null;
    };
    createMarketMetadataRefresher?: (options?: {
      onStatus?: (status: {
        state: 'fresh' | 'stale' | 'unavailable';
        lastAttemptAt: number | null;
        lastSuccessAt: number | null;
        error: string | null;
      }) => void;
    }) => unknown;
    applyCoinGeckoMarketMetadata?: (rows: unknown[], options?: Record<string, unknown>) => void;
  }
}

type BootIssue = { title: string; detail: string };

/**
 * Next.js runtime boundary for the legacy TradeMate app.
 * Startup diagnostics live here because /app does not load public/tm/index.html.
 * No loading screen is shown: the page renders nothing until the legacy app
 * paints itself, and only a real startup failure shows the error card below.
 */
export default function TradeMateRuntime() {
  const [issue, setIssue] = useState<BootIssue | null>(null);

  useEffect(() => {
    if (window.__tradeMateBooted) return;
    window.__tradeMateBooted = true;
    window.TM_CONFIG = { api: '/api' };

    let settled = false;
    let feedReady = false;
    let feedMediaReady = false;
    let viewportModuleReady = false;
    let metadataReady = false;
    let marketQuoteUtilsReady = false;
    let snapshotUtilsReady = false;
    let fxSnapshotUtilsReady = false;
    let nftItemUtilsReady = false;
    let artUtilsReady = false;
    let cssReady = false;
    let layoutCssReady = false;
    let patchesCssReady = false;
    let portfolioCssReady = false;
    let polishCssReady = false;
    let nftCssReady = false;
    let searchCssReady = false;
    let contractfCssReady = false;
    let contractf2CssReady = false;
    let helpCssReady = false;
    let headerCssReady = false;
    let feedbackCssReady = false;
    let learnCssReady = false;
    let earnCssReady = false;
    const fail = (title: string, detail: string) => {
      if (settled) return;
      settled = true;
      window.__tradeMateBooted = false;
      const overlay = document.getElementById('lp');
      if (overlay) overlay.style.display = 'none';
      setIssue({ title, detail });
    };

    const onError = (event: ErrorEvent) => {
      const source = event.filename || '';
      if (!source || source.includes('/tm/app.js') || source.includes('/tm/app.light.js') || source.includes('feed-client.js')) {
        fail('TradeMate could not start', [event.message || 'A JavaScript startup error occurred.', event.filename ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}` : '', event.error instanceof Error && event.error.stack ? event.error.stack : ''].filter(Boolean).join('\n'));
      }
    };
    // Do not promote arbitrary application-level promise rejections to a
    // full-screen startup failure. The legacy app intentionally handles many
    // feature requests asynchronously; script errors, load errors and the
    // render watchdog below are the startup-specific diagnostics.
    window.addEventListener('error', onError);

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=162';
    app.async = false;
    app.dataset.trademateApp = 'true';
    app.onerror = () => fail('TradeMate could not load', 'The app script failed to load from /tm/app.js?v=161. Check the deployment and static asset response.');
    app.onload = () => {
      const postAppModules = [
        'pm-fix-css-loader',
        'pm-card-height-sync',
        'pm-ring-css-loader',
        'pm-final-css-loader',
        'pm-final2-css-loader',
        'pm-tiles-css-loader',
        'pm-contract-card-loader',
        'pm-final3-css-loader',
        'tm-top-redesign-loader',
        'tm-unify-loader',
        'tm-consistency-css-loader',
        'pm-mobile-size-css-loader',
        'pm-calm-css-loader',
        'tm-home-svc-css-loader',
        'tm-home-grid-css-loader',
        'tm-home-more-css-loader',
        'tm-home-explore-size-loader',
        'pm-docs-css-loader',
        'tm-light-solid-patch',
        'tm-light-palette-patch',
        'pf-size-loader',
        'pm-ring-light-loader',
        'tm-doc-icons-loader',
        'tm-scout-light-loader',
        'tm-mk-compact-loader',
        'tm-tl-acts-loader',
        'tm-tl-desktop-fit-loader',
        'tm-tl-noborder-loader',
        'tm-feed-desktop-fill-loader',
        'tm-desktop-polish-loader',
        'scout-wallet-fix', 'cards-map-fix', 'feed-x-layout', 'profile-x-layout',
        'scout-spin-fix', 'feed-desktop-media', 'timeline-nav-fix',
        'timeline-chip-small', 'scout-spin-fix-2',
      ];
      // Dynamic classic scripts with async=false execute in insertion order.
      // Appending the whole queue avoids serial network waits while preserving
      // the original stylesheet-loader order.
      postAppModules.forEach((moduleName) => {
        const moduleScript = document.createElement('script');
        moduleScript.src = `/tm/${moduleName}.js?v=1`;
        moduleScript.async = false;
        document.body.appendChild(moduleScript);
      });
    };

    const loadApp = () => {
      if (!feedReady || !feedMediaReady || !viewportModuleReady || !metadataReady || !marketQuoteUtilsReady || !snapshotUtilsReady || !fxSnapshotUtilsReady || !nftItemUtilsReady || !artUtilsReady || !cssReady || !layoutCssReady || !patchesCssReady || !portfolioCssReady || !polishCssReady || !nftCssReady || !searchCssReady || !contractfCssReady || !contractf2CssReady || !helpCssReady || !headerCssReady || !feedbackCssReady || !learnCssReady || !earnCssReady || settled || document.querySelector('script[data-trademate-app]')) return;
      document.body.appendChild(app);
    };

    // The first legacy runtime style is now a real blocking stylesheet.
    // Do not start app.js until it is ready, preserving the original startup
    // cascade and preventing the app from painting without its base rule.
    const baseCss = document.createElement('link');
    baseCss.rel = 'stylesheet';
    baseCss.href = '/tm/runtime-base.css?v=1';
    baseCss.onload = () => {
      cssReady = true;
      loadApp();
    };
    baseCss.onerror = () => {
      // Keep startup resilient if the static CSS asset is unavailable.
      const fallback = document.createElement('style');
      fallback.textContent = 'input,select,textarea{font-size:16px!important}';
      document.head.appendChild(fallback);
      cssReady = true;
      loadApp();
    };
    document.head.appendChild(baseCss);

    // Fetch the next extracted runtime stylesheet before app.js executes.
    // app.js inserts its stylesheet link at the former style-block position,
    // preserving the original cascade order while avoiding a late CSS fetch.
    const layoutPreload = document.createElement('link');
    layoutPreload.rel = 'preload';
    layoutPreload.as = 'style';
    layoutPreload.href = '/tm/runtime-layout.css?v=1';
    layoutPreload.onload = () => {
      layoutCssReady = true;
      loadApp();
    };
    layoutPreload.onerror = () => {
      // Do not prevent the application from starting if the optional preload
      // hint fails; app.js still inserts the stylesheet at its cascade point.
      layoutCssReady = true;
      loadApp();
    };
    document.head.appendChild(layoutPreload);

    const patchesPreload = document.createElement('link');
    patchesPreload.rel = 'preload';
    patchesPreload.as = 'style';
    patchesPreload.href = '/tm/runtime-patches.css?v=1';
    patchesPreload.onload = () => {
      patchesCssReady = true;
      loadApp();
    };
    patchesPreload.onerror = () => {
      patchesCssReady = true;
      loadApp();
    };
    document.head.appendChild(patchesPreload);

    const portfolioPreload = document.createElement('link');
    portfolioPreload.rel = 'preload';
    portfolioPreload.as = 'style';
    portfolioPreload.href = '/tm/runtime-portfolio.css?v=1';
    portfolioPreload.onload = () => {
      portfolioCssReady = true;
      loadApp();
    };
    portfolioPreload.onerror = () => {
      portfolioCssReady = true;
      loadApp();
    };
    document.head.appendChild(portfolioPreload);

    const polishPreload = document.createElement('link');
    polishPreload.rel = 'preload';
    polishPreload.as = 'style';
    polishPreload.href = '/tm/runtime-polish.css?v=3';
    polishPreload.onload = () => {
      polishCssReady = true;
      loadApp();
    };
    polishPreload.onerror = () => {
      polishCssReady = true;
      loadApp();
    };
    document.head.appendChild(polishPreload);


    const nftPreload = document.createElement('link');
    nftPreload.rel = 'preload';
    nftPreload.as = 'style';
    nftPreload.href = '/tm/runtime-nft.css?v=1';
    nftPreload.onload = () => {
      nftCssReady = true;
      loadApp();
    };
    nftPreload.onerror = () => {
      nftCssReady = true;
      loadApp();
    };
    document.head.appendChild(nftPreload);


    const searchPreload = document.createElement('link');
    searchPreload.rel = 'preload';
    searchPreload.as = 'style';
    searchPreload.href = '/tm/runtime-search.css?v=1';
    searchPreload.onload = () => {
      searchCssReady = true;
      loadApp();
    };
    searchPreload.onerror = () => {
      searchCssReady = true;
      loadApp();
    };
    document.head.appendChild(searchPreload);

    const contractfPreload = document.createElement('link');
    contractfPreload.rel = 'preload';
    contractfPreload.as = 'style';
    contractfPreload.href = '/tm/runtime-contractf.css?v=1';
    contractfPreload.onload = () => {
      contractfCssReady = true;
      loadApp();
    };
    contractfPreload.onerror = () => {
      contractfCssReady = true;
      loadApp();
    };
    document.head.appendChild(contractfPreload);

    const contractf2Preload = document.createElement('link');
    contractf2Preload.rel = 'preload';
    contractf2Preload.as = 'style';
    contractf2Preload.href = '/tm/runtime-contractf2.css?v=1';
    contractf2Preload.onload = () => {
      contractf2CssReady = true;
      loadApp();
    };
    contractf2Preload.onerror = () => {
      contractf2CssReady = true;
      loadApp();
    };
    document.head.appendChild(contractf2Preload);


    const helpPreload = document.createElement('link');
    helpPreload.rel = 'preload';
    helpPreload.as = 'style';
    helpPreload.href = '/tm/runtime-help.css?v=1';
    helpPreload.onload = () => { helpCssReady = true; loadApp(); };
    helpPreload.onerror = () => { helpCssReady = true; loadApp(); };
    document.head.appendChild(helpPreload);

    const headerPreload = document.createElement('link');
    headerPreload.rel = 'preload';
    headerPreload.as = 'style';
    headerPreload.href = '/tm/runtime-header.css?v=2';
    headerPreload.onload = () => { headerCssReady = true; loadApp(); };
    headerPreload.onerror = () => { headerCssReady = true; loadApp(); };
    document.head.appendChild(headerPreload);
    const feedbackPreload = document.createElement('link');
    feedbackPreload.rel = 'preload';
    feedbackPreload.as = 'style';
    feedbackPreload.href = '/tm/runtime-feedback.css?v=1';
    feedbackPreload.onload = () => { feedbackCssReady = true; loadApp(); };
    feedbackPreload.onerror = () => { feedbackCssReady = true; loadApp(); };
    document.head.appendChild(feedbackPreload);

    const learnPreload = document.createElement('link');
    learnPreload.rel = 'preload';
    learnPreload.as = 'style';
    learnPreload.href = '/tm/runtime-learn.css?v=1';
    learnPreload.onload = () => { learnCssReady = true; loadApp(); };
    learnPreload.onerror = () => { learnCssReady = true; loadApp(); };
    document.head.appendChild(learnPreload);

    const earnPreload = document.createElement('link');
    earnPreload.rel = 'preload';
    earnPreload.as = 'style';
    earnPreload.href = '/tm/runtime-earn.css?v=1';
    earnPreload.onload = () => { earnCssReady = true; loadApp(); };
    earnPreload.onerror = () => { earnCssReady = true; loadApp(); };
    document.head.appendChild(earnPreload);

    // Snapshot factories must be ready before app.js binds legacy snapshot helpers.
    const snapshotUtils = document.createElement('script');
    snapshotUtils.src = '/tm/snapshot-utils.js?v=1';
    snapshotUtils.async = false;
    snapshotUtils.onload = () => {
      if (!window.TM_SNAPSHOT_UTILS) {
        fail('TradeMate could not start', 'The snapshot utility module loaded without initialising.');
        return;
      }
      snapshotUtilsReady = true;
      loadApp();
    };
    snapshotUtils.onerror = () => fail('TradeMate could not load', 'The required snapshot utility module failed to load.');
    document.body.appendChild(snapshotUtils);

    // Static decorative SVG renderers are isolated from app state and must be ready before app.js.
    const artUtils = document.createElement('script');
    artUtils.src = '/tm/art-utils.js?v=2';
    artUtils.async = false;
    artUtils.onload = () => {
      if (!window.TM_ART_UTILS) {
        fail('TradeMate could not start', 'The decorative art utility module loaded without initialising.');
        return;
      }
      artUtilsReady = true;
      loadApp();
    };
    artUtils.onerror = () => fail('TradeMate could not load', 'The required decorative art utility module failed to load.');
    document.body.appendChild(artUtils);

    // Pure NFT item normalization is loaded before app.js binds the legacy call sites.
    const nftItemUtils = document.createElement('script');
    nftItemUtils.src = '/tm/nft-item-utils.js?v=3';
    nftItemUtils.async = false;
    nftItemUtils.onload = () => {
      if (!window.TM_NFT_ITEM_UTILS) {
        fail('TradeMate could not start', 'The NFT item utility module loaded without initialising.');
        return;
      }
      nftItemUtilsReady = true;
      loadApp();
    };
    nftItemUtils.onerror = () => fail('TradeMate could not load', 'The required NFT item utility module failed to load.');
    document.body.appendChild(nftItemUtils);

    // FX snapshot helpers receive the market item collection explicitly; no app globals leak into the module.
    const fxSnapshotUtils = document.createElement('script');
    fxSnapshotUtils.src = '/tm/fx-snapshot-utils.js?v=1';
    fxSnapshotUtils.async = false;
    fxSnapshotUtils.onload = () => {
      if (!window.TM_FX_SNAPSHOT_UTILS) {
        fail('TradeMate could not start', 'The FX snapshot utility module loaded without initialising.');
        return;
      }
      fxSnapshotUtilsReady = true;
      loadApp();
    };
    fxSnapshotUtils.onerror = () => fail('TradeMate could not load', 'The required FX snapshot utility module failed to load.');
    document.body.appendChild(fxSnapshotUtils);

    // Market quote utilities must be ready before app.js defines the MT5 quote adapters.
    const marketQuoteUtils = document.createElement('script');
    marketQuoteUtils.src = '/tm/market-quote-utils.js?v=2';
    marketQuoteUtils.async = false;
    marketQuoteUtils.onload = () => {
      if (!window.TM_MARKET_QUOTE_UTILS) {
        fail('TradeMate could not start', 'The market quote utility module loaded without initialising.');
        return;
      }
      marketQuoteUtilsReady = true;
      loadApp();
    };
    marketQuoteUtils.onerror = () => fail('TradeMate could not load', 'The required market quote utility module failed to load.');
    document.body.appendChild(marketQuoteUtils);

    // Load the independently tested market-metadata lifecycle helper before
    // app.js. If it is unavailable, app.js retains its conservative legacy
    // fallback so a public metadata dependency cannot block core startup.
    const metadata = document.createElement('script');
    metadata.src = '/tm/market-metadata.js?v=1';
    metadata.async = false;
    metadata.onload = () => {
      if (!window.createMarketMetadataRefresher || !window.applyCoinGeckoMarketMetadata) {
        window.tmMarketMetadataStatus = {
          state: 'unavailable',
          lastAttemptAt: null,
          lastSuccessAt: null,
          error: 'Market metadata helper did not initialise correctly',
        };
      }
      metadataReady = true;
      loadApp();
    };
    metadata.onerror = () => {
      // Market metadata is secondary to the exchange-feed spot quote. Fail
      // closed for this optional source while keeping the core app available.
      window.tmMarketMetadataStatus = {
        state: 'unavailable',
        lastAttemptAt: null,
        lastSuccessAt: null,
        error: 'Market metadata helper could not be loaded',
      };
      metadataReady = true;
      loadApp();
    };
    document.body.appendChild(metadata);

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js?v=2';
    feed.async = false;
    feed.onload = () => {
      feedReady = true;
      loadApp();
    };
    feed.onerror = () => {
      // The feed helper is optional for rendering the core application.
      feedReady = true;
      loadApp();
    };
    document.body.appendChild(feed);

    // Feed media lightbox is isolated from app state and is optional for core startup.
    const feedMedia = document.createElement('script');
    feedMedia.src = '/tm/feed-media-lightbox.js?v=1';
    feedMedia.async = false;
    feedMedia.onload = () => {
      feedMediaReady = true;
      loadApp();
    };
    feedMedia.onerror = () => {
      feedMediaReady = true;
      loadApp();
    };
    document.body.appendChild(feedMedia);


    // Viewport setup is the only extracted patch that must run before app.js.
    const viewportModule = document.createElement('script');
    viewportModule.src = '/tm/viewport-meta.js?v=1';
    viewportModule.async = false;
    viewportModule.onload = viewportModule.onerror = () => {
      viewportModuleReady = true;
      loadApp();
    };
    document.body.appendChild(viewportModule);

    // The Next.js /app route does not execute public/tm/index.html, so it needs
    // its own rendered-shell and landing-overlay watchdog.
    window.setTimeout(() => {
      if (settled) return;
      const root = document.getElementById('app');
      const nav = document.getElementById('nav');
      const rendered = !!root?.querySelector('.view') && !!nav?.innerHTML.trim();
      if (!rendered) {
        fail(
          'TradeMate could not start',
          'The app shell did not render within 8 seconds. Check the browser console and confirm /tm/app.js?v=161 returns successfully.'
        );
        return;
      }

      const overlay = document.getElementById('lp') as (HTMLElement & { shadowRoot: ShadowRoot | null }) | null;
      const surface = overlay?.shadowRoot?.querySelector('.sc');
      if (overlay && (!surface || !surface.textContent?.trim() ||
        surface.getBoundingClientRect().width === 0 || surface.getBoundingClientRect().height === 0)) {
        overlay.style.display = 'none';
      }
      settled = true;
    }, 8000);

    // Keep listeners/scripts alive through React Strict Mode effect replay:
    // the legacy runtime owns the DOM and its WebSocket lifecycle.
  }, []);

  if (!issue) return null;

  return (
    <main role="alert" style={{
      position: 'fixed', inset: 0, zIndex: 20000, display: 'grid',
      placeItems: 'center', padding: 20, background: '#050505',
      color: '#f5f7fa', fontFamily: 'system-ui, sans-serif',
    }}>
      <section style={{
        width: 'min(100%, 520px)', padding: 22, borderRadius: 16,
        border: '1px solid #704b32', background: '#111820',
        boxShadow: '0 18px 60px #0009',
      }}>
        <p style={{ margin: '0 0 8px', color: '#ffb02e', fontSize: 11, fontWeight: 800, letterSpacing: '.12em' }}>
          TRADEMATE STARTUP
        </p>
        <h1 style={{ margin: '0 0 10px', fontSize: 22 }}>{issue.title}</h1>
        <p style={{ margin: '0 0 18px', color: '#b8c2ce', fontSize: 13, lineHeight: 1.55 }}>
          {issue.detail}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: 0, borderRadius: 10, padding: '11px 16px',
            background: '#ffb02e', color: '#17110a', fontWeight: 800,
          }}
        >
          Reload app
        </button>
      </section>
    </main>
  );
}
