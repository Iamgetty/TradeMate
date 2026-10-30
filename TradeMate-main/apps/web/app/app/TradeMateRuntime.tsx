'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    TM_CONFIG?: { api: string };
    __tradeMateBooted?: boolean;
    __tradeMateStartupError?: string;
  }
}

export default function TradeMateRuntime() {
  const [notice, setNotice] = useState('');
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const verifyInterface = () => {
      const appRoot = document.getElementById('app');
      const navRoot = document.getElementById('nav');
      const landingRoot = document.getElementById('lp');
      const rendered = !!(
        appRoot?.children.length &&
        navRoot?.children.length &&
        landingRoot?.shadowRoot?.children.length
      );

      if (rendered && !window.__tradeMateStartupError) {
        setBooted(true);
        return true;
      }

      setBooted(false);
      setNotice(
        window.__tradeMateStartupError ||
        'The TradeMate script loaded, but the interface did not finish rendering. The startup check has stopped rather than showing a blank page.'
      );
      return false;
    };

    const existingApp = document.querySelector<HTMLScriptElement>('script[data-trademate-app]');
    if (existingApp) {
      if (existingApp.dataset.loaded === 'true') {
        verifyInterface();
      } else {
        existingApp.addEventListener('load', verifyInterface, { once: true });
        existingApp.addEventListener('error', () => {
          setNotice('TradeMate could not load its main interface script. Please reload the page.');
        }, { once: true });
      }
      return;
    }

    // A stale global flag without its script element must never block startup.
    window.__tradeMateBooted = true;
    window.__tradeMateStartupError = '';
    window.TM_CONFIG = { api: '/api' };

    let feedFallbackTimer: number | undefined;
    let appStartupTimer: number | undefined;
    let appStarted = false;

    const handleRuntimeError = (event: ErrorEvent) => {
      if (event.filename && event.filename.includes('/tm/app.js')) {
        const message = 'TradeMate hit a JavaScript error while building the interface. The page has kept the startup diagnostic visible instead of hiding it.';
        window.__tradeMateStartupError = message;
        setNotice(message);
        setBooted(false);
      }
    };
    window.addEventListener('error', handleRuntimeError);

    const app = document.createElement('script');
    app.src = '/tm/app.js?v=10';
    app.async = false;
    app.dataset.trademateApp = 'true';
    app.onload = () => {
      app.dataset.loaded = 'true';
      window.clearTimeout(appStartupTimer);
      // Script load only means download/evaluation completed. Confirm that
      // app.js created and populated all three roots before hiding the loader.
      window.setTimeout(() => {
        if (!verifyInterface()) {
          window.__tradeMateBooted = false;
        }
      }, 0);
    };
    app.onerror = () => {
      window.clearTimeout(appStartupTimer);
      window.__tradeMateBooted = false;
      setBooted(false);
      setNotice('TradeMate could not download /tm/app.js. Check that the deployed web build includes the public/tm files.');
    };

    const loadApp = () => {
      if (appStarted) return;
      appStarted = true;
      if (feedFallbackTimer) window.clearTimeout(feedFallbackTimer);
      document.body.appendChild(app);
      appStartupTimer = window.setTimeout(() => {
        if (!document.getElementById('app')?.children.length) {
          setBooted(false);
          setNotice('TradeMate is still waiting for its interface to render. The main app script did not create the expected screen.');
        }
      }, 15000);
    };

    const feed = document.createElement('script');
    feed.src = '/tm/feed-client.js?v=2';
    feed.async = false;
    feed.onload = loadApp;
    feed.onerror = () => {
      setNotice('The live exchange-feed helper did not load. Opening the app without that optional helper.');
      loadApp();
    };

    feedFallbackTimer = window.setTimeout(() => {
      setNotice('The live exchange-feed helper is taking too long. Opening TradeMate without waiting for it.');
      loadApp();
    }, 3000);

    document.body.appendChild(feed);
  }, []);

  return (
    <>
      {!booted && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', zIndex: 10000, inset: 0, display: 'grid',
          placeContent: 'center', gap: 10, padding: 24, textAlign: 'center',
          background: '#05070a', color: '#f5f7fa', font: '14px system-ui',
        }}>
          <strong style={{ fontSize: 18 }}>Opening TradeMate…</strong>
          <span style={{ color: '#9aa8b8', maxWidth: 340, lineHeight: 1.5 }}>
            {notice || 'Loading your markets and workspace.'}
          </span>
        </div>
      )}
      {booted && notice && (
        <div role="status" style={{
          position: 'fixed', zIndex: 10000, left: 12, right: 12, bottom: 12,
          padding: '10px 14px', border: '1px solid #73552b', borderRadius: 10,
          background: '#21190e', color: '#ffd28a', font: '12px system-ui',
        }}>
          {notice}
        </div>
      )}
    </>
  );
}
