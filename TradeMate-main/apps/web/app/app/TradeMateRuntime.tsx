'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    __tradeMateBooted?: boolean;
  }
}

/**
 * Next.js route boundary for the existing TradeMate runtime.
 * The legacy runtime is intentionally retained during the incremental React
 * migration so the live product UI and its existing workflows are not lost.
 */
export default function TradeMateRuntime() {
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.__tradeMateBooted) return;
    window.__tradeMateBooted = true;
    window.TM_CONFIG = { api: '/api' };

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js';
    feed.async = false;

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=7';
    app.async = false;

    feed.onerror = () => setError('TradeMate market feed client could not be loaded. Please refresh.');
    app.onerror = () => setError('TradeMate application could not be loaded. Please refresh.');

    feed.onload = () => document.body.appendChild(app);
    document.body.appendChild(feed);

    return () => {
      // The runtime owns its generated DOM and long-lived market connections.
      // Do not tear it down during React strict-mode effect replay.
    };
  }, []);

  return error ? (
    <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#05070a', color: '#f5f7fa', fontFamily: 'system-ui' }}>
      {error}
    </main>
  ) : null;
}
