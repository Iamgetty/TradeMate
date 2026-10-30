'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    __tradeMateBooted?: boolean;
  }
}

/**
 * Temporary Next.js boundary while individual legacy screens are migrated
 * into React. It keeps the existing product UI running without replacing it.
 */
export default function TradeMateRuntime() {
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (window.__tradeMateBooted) return;
    window.__tradeMateBooted = true;
    window.TM_CONFIG = { api: '/api' };

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=8';
    app.async = false;

    const loadApp = () => {
      if (!document.querySelector('script[data-trademate-app]')) {
        app.dataset.trademateApp = 'true';
        app.onerror = () => {
          window.__tradeMateBooted = false;
          setNotice('TradeMate could not load. Please refresh the page.');
        };
        document.body.appendChild(app);
      }
    };

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js';
    feed.async = false;
    feed.onload = loadApp;
    feed.onerror = () => {
      setNotice('Live exchange feed client did not load. The app will still open, but live Book and Trades may be unavailable.');
      loadApp();
    };
    document.body.appendChild(feed);

    return () => {
      // Do not remove the scripts or app DOM during React Strict Mode replay:
      // the existing runtime owns its navigation and WebSocket lifecycle.
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
