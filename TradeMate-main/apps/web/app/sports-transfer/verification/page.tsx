'use client';

import { useCallback, useEffect, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';

type VerificationCase = {
  id: string;
  case_type: string;
  status: string;
  country_code: string | null;
  created_at: string;
};

declare global {
  interface Window {
    snsWebSdk?: {
      init: (token: string, refreshToken: () => Promise<string>) => {
        withConf: (config: Record<string, unknown>) => any;
        withOptions: (options: Record<string, unknown>) => any;
        on: (event: string, callback: (payload: unknown) => void) => any;
        build: () => { launch: (selector: string) => void };
      };
    };
  }
}

const API = '/api/sports-transfer/verification-cases';

export default function SportsTransferVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [caseRecord, setCaseRecord] = useState<VerificationCase | null>(null);
  const [status, setStatus] = useState('Not started');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('NG');
  const [sdkMounted, setSdkMounted] = useState(false);

  const requestJson = useCallback(async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (init?.body) headers.set('content-type', 'application/json');
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'TradeMate could not complete this request.');
    return payload;
  }, []);

  const loadCases = useCallback(async () => {
    const result = await requestJson(API + '/mine');
    const cases: VerificationCase[] = Array.isArray(result.verificationCases) ? result.verificationCases : [];
    const current = cases.find(item => item.case_type === 'legal_identity'
      && ['submitted', 'processing', 'needs_review', 'disputed'].includes(item.status));
    setCaseRecord(current || null);
    if (current) {
      setStatus(current.status.replaceAll('_', ' '));
      if (current.country_code) setCountryCode(current.country_code);
    }
  }, [requestJson]);

  useEffect(() => {
    loadCases()
      .catch(() => setError('Sign in to TradeMate to start legal identity verification.'))
      .finally(() => setLoading(false));
  }, [loadCases]);

  const launchSdk = useCallback((token: string, getFreshToken: () => Promise<string>) => {
    if (!window.snsWebSdk) throw new Error('The Sumsub verification interface has not loaded yet.');
    const instance = window.snsWebSdk
      .init(token, getFreshToken)
      .withConf({ lang: 'en', theme: 'dark' })
      .withOptions({ addViewportTag: false, adaptIframeHeight: true })
      .on('idCheck.onStepCompleted', () => {
        setMessage('A verification step was submitted. You can safely close this page after the provider confirms completion.');
      })
      .on('idCheck.onError', () => {
        setError('The verification provider reported a problem. Please retry or contact TradeMate support.');
      })
      .build();
    instance.launch('#sumsub-websdk-container');
    setSdkMounted(true);
  }, []);

  async function startVerification() {
    setStarting(true);
    setError('');
    setMessage('');
    try {
      let current = caseRecord;
      if (!current) {
        const created = await requestJson(API, {
          method: 'POST',
          body: JSON.stringify({
            caseType: 'legal_identity',
            countryCode,
            claimStatement: 'I request legal identity assurance for my TradeMate account through the configured identity verification provider.',
          }),
        });
        current = created.verificationCase;
        setCaseRecord(current);
      }
      const caseId = current.id;
      const session = await requestJson(API + '/' + caseId + '/session', { method: 'POST' });
      setStatus('processing');
      if (!session.sdkAccessToken) {
        setMessage(session.message || 'The configured environment does not currently provide live document capture.');
        return;
      }
      if (!sdkReady || !window.snsWebSdk) {
        throw new Error('The Sumsub WebSDK is still loading. Please try again in a moment.');
      }
      launchSdk(session.sdkAccessToken, async () => {
        const fresh = await requestJson(API + '/' + caseId + '/session', { method: 'POST' });
        if (!fresh.sdkAccessToken) throw new Error('A refreshed Sumsub access token is unavailable.');
        return fresh.sdkAccessToken;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start identity verification.');
    } finally {
      setStarting(false);
    }
  }

  async function refreshStatus() {
    if (!caseRecord) return;
    setError('');
    try {
      const result = await requestJson(API + '/' + caseRecord.id + '/session');
      if (result.session?.status) setStatus(String(result.session.status).replaceAll('_', ' '));
      if (result.providerOutcome) {
        setMessage('Sumsub has returned a result. TradeMate review is still required before your identity is marked verified.');
      } else {
        setMessage(result.message || 'Status refreshed.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not refresh verification status.');
    }
  }

  return (
    <main className="web3-shell account-shell">
      <Script
        src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() => setError('The Sumsub verification interface could not be loaded. Check your connection and try again.')}
      />
      <header className="top-nav">
        <Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link>
        <Link className="nav-pill account-logout" href="/account">My account ↗</Link>
      </header>
      <section className="account-wrap">
        <div className="section-kicker"><span/> SPORTS TRANSFER · IDENTITY</div>
        <h1>Verify your<br/><span>identity.</span></h1>
        <p className="account-lead">Confirm your legal identity securely through our verification partner. Your documents are submitted directly to the provider, not stored in TradeMate's ordinary application database.</p>
        {loading ? <div className="market-state"><h3>Loading your verification status…</h3></div> : <>
          <div className="account-card">
            <div><strong>Legal identity verification</strong><span>Provider: Sumsub · Individual KYC</span><small>CASE STATUS · {status.toUpperCase()}</small></div>
          </div>
          {!sdkMounted && <div className="account-next">
            <label htmlFor="verification-country">Country of residence (ISO two-letter code)</label>
            <input id="verification-country" value={countryCode} maxLength={2} autoComplete="country" placeholder="e.g. NG"
              onChange={event => setCountryCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
              className="verification-country" />
            <button className="cta-primary detail-back" disabled={starting || !sdkReady || !/^[A-Z]{2}$/.test(countryCode)} onClick={startVerification}>
              {starting ? 'Preparing secure session…' : caseRecord ? 'Continue verification ↗' : 'Start identity verification ↗'}
            </button>
            {caseRecord && <button className="account-secondary-link" onClick={refreshStatus}>Refresh verification status →</button>}
            <p className="account-lead">You will complete document capture and any required liveness steps inside Sumsub's secure interface. A provider result does not automatically approve your TradeMate identity.</p>
          </div>}
          <div id="sumsub-websdk-container" className="sumsub-sdk-container" />
          {message && <p role="status" className="verification-message">{message}</p>}
          {error && <p role="alert" className="verification-error">{error}</p>}
        </>}
      </section>
      <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/account">MY ACCOUNT ↗</Link></footer>
      <style jsx>{`
        .verification-country{display:block;width:100%;margin:10px 0 22px;padding:14px 16px;border:1px solid rgba(255,255,255,.14);border-radius:12px;background:#111;color:#fff;font:inherit}
        .sumsub-sdk-container{width:100%;min-height:0;margin-top:24px}
        .sumsub-sdk-container:empty{display:none}
        .verification-message,.verification-error{padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.06);line-height:1.5}
        .verification-error{color:#ffb6b6}
        button:disabled{opacity:.55;cursor:not-allowed}
      `}</style>
    </main>
  );
}
