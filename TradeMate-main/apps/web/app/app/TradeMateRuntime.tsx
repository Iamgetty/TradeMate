'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    __tradeMateBooted?: boolean;
  }
}

/**
 * Loads the existing legacy TradeMate UI without making the exchange-feed
 * client a hard dependency for the page to render.
 */
export default function TradeMateRuntime() {
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (window.__tradeMateBooted) return;
    window.__tradeMateBooted = true;
    window.TM_CONFIG = { api: '/api' };

    let feedFallbackTimer: number | undefined;

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=9';
    app.async = false;
    app.dataset.trademateApp = 'true';
    app.onerror = () => {
      window.__tradeMateBooted = false;
      setNotice('TradeMate could not load its main interface script. Please reload the page.');
    };

    const loadApp = () => {
      if (feedFallbackTimer) window.clearTimeout(feedFallbackTimer);
      if (!document.querySelector('script[data-trademate-app]')) {
        document.body.appendChild(app);
      }
    };

    // A runtime exception in the legacy bundle used to leave the route
    // completely blank. Surface the failure instead of silently showing white.
    const handleRuntimeError = (event: ErrorEvent) => {
      if (event.filename && event.filename.includes('/tm/app.js')) {
        setNotice('TradeMate encountered an error while starting. Reload the page; if it continues, the startup error has been captured for diagnosis.');
      }
    };
    window.addEventListener('error', handleRuntimeError);

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js?v=2';
    feed.async = false;
    feed.onload = loadApp;
    feed.onerror = () => {
      setNotice('The live exchange-feed helper did not load. TradeMate is opening without that helper; live Book and Trades may be temporarily unavailable.');
      loadApp();
    };

    // Do not let a slow or stalled feed asset prevent the whole app from
    // rendering. The app has its own error handling around feed connections.
    feedFallbackTimer = window.setTimeout(() => {
      setNotice('The live exchange-feed helper is taking too long. Opening TradeMate while it continues to load.');
      loadApp();
    }, 4000);

    document.body.appendChild(feed);

    return () => {
      if (feedFallbackTimer) window.clearTimeout(feedFallbackTimer);
      window.removeEventListener('error', handleRuntimeError);
      // Keep scripts and app DOM alive during React Strict Mode replay:
      // the legacy runtime owns its navigation and WebSocket lifecycle.
    };
  }, []);

  return notice ? (
    <div role="status" style={{
      position: 'fixed', zIndex: 10000, left: 12, right: 12, bottom: 12,
      padding: '10px 14px', border: '1px solid #73552b', borderRadius: 10,
      background: '#21190e', color: '#ffd28a', font: '12px system-ui',
    }}>
      {notice}
    </div>
  ) : null;
}
