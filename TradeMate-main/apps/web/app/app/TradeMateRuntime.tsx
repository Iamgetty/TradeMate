'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    __tradeMateBooted?: boolean;
  }
}

type BootIssue = { title: string; detail: string };

/**
 * Next.js runtime boundary for the legacy TradeMate app.
 * Startup diagnostics live here because /app does not load public/tm/index.html.
 */
export default function TradeMateRuntime() {
  const [issue, setIssue] = useState<BootIssue | null>(null);

  useEffect(() => {
    if (window.__tradeMateBooted) return;
    window.__tradeMateBooted = true;
    window.TM_CONFIG = { api: '/api' };

    let settled = false;
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
      if (!source || source.includes('/tm/app.js') || source.includes('feed-client.js')) {
        fail('TradeMate could not start', event.message || 'A JavaScript startup error occurred.');
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const detail = reason instanceof Error ? reason.stack || reason.message : String(reason ?? 'Unknown promise rejection');
      fail('TradeMate startup failed', detail);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=31';
    app.async = false;
    app.dataset.trademateApp = 'true';
    app.onerror = () => fail('TradeMate could not load', 'The app script failed to load from /tm/app.js?v=31. Check the deployment and static asset response.');

    const loadApp = () => {
      if (settled || document.querySelector('script[data-trademate-app]')) return;
      document.body.appendChild(app);
    };

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js?v=2';
    feed.async = false;
    feed.onload = loadApp;
    feed.onerror = () => {
      // The feed helper is optional for rendering the core application.
      loadApp();
    };
    document.body.appendChild(feed);

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
          'The app shell did not render within 8 seconds. Check the browser console and confirm /tm/app.js?v=31 returns successfully.'
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
