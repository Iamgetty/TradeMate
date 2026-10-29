'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API_BASE = '';
type Business = { name: string; country_code: string; default_currency: string; status: string };
type SavedOffer = { id: string; title: string; status: string; currency_code: string; price_minor_units: string };
const money = (minor: string, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor) / 100); }
  catch { return currency + ' ' + (Number(minor) / 100).toFixed(2); }
};

export default function NewOfferPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState('product');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedOffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
        if (!me.ok) { router.replace('/auth?mode=login'); return; }
        const response = await fetch('/api/organizations/mine', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load your business space. Please return to your account and try again.');
        const data = await response.json();
        if (!data.organization) { router.replace('/business'); return; }
        if (!cancelled) setBusiness(data.organization);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not connect to TradeMate.');
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/market/listings', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, listingType, price, quantityAvailable: listingType === 'product' ? quantity : null }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace('/auth?mode=login'); return; }
      if (!response.ok) throw new Error(data.message || 'We could not save this offer. Please try again.');
      setSaved(data.listing);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection issue. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="web3-shell account-shell">
    <header className="top-nav"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><Link className="nav-pill" href="/account">My space ↗</Link></header>
    <section className="business-wrap">
      <div className="business-visual"><div className="business-orbit orbit-a"/><div className="business-orbit orbit-b"/><div className="business-core">↗</div><span className="business-chip">YOUR NEXT OPPORTUNITY</span></div>
      <div className="business-panel">
        <div className="section-kicker"><span/> STEP 03 / CREATE AN OFFER</div>
        {saved ? <>
          <div className="section-kicker" style={{marginTop:24}}><span/> DRAFT SAVED</div>
          <h1>Your offer is <span>taking shape.</span></h1>
          <p className="business-intro">“{saved.title}” has been saved to your business space as a draft.</p>
          <div className="account-card"><div><strong>{money(saved.price_minor_units, saved.currency_code)}</strong><span>{saved.title}</span><small>OFFER STATUS · {saved.status.toUpperCase()}</small></div></div>
          <p className="business-footnote">This draft is not publicly visible yet. Publishing will be enabled when TradeMate's seller review and publishing controls are ready.</p>
          <Link className="cta-primary detail-back" href="/offers">View my offers ↗</Link><Link className="account-secondary-link" href="/account">Return to your space</Link>
          <button type="button" className="retry-btn" onClick={() => { setSaved(null); setTitle(''); setDescription(''); setPrice(''); setQuantity(''); }}>Create another draft ↻</button>
        </> : <>
          <h1>Put your offer <span>out there.</span></h1>
          <p className="business-intro">Start with the essentials. You can prepare a product or service offer for the global marketplace.</p>
          {loading ? <div className="market-state"><h3>Loading your business space…</h3></div> : business && <>
            <div className="detail-note">BUSINESS · {business.name} · {business.country_code} <br/>Currency: {business.default_currency} · Business status: {business.status}</div>
            <form className="auth-form" onSubmit={submit}>
              <label>What are you offering?<select value={listingType} onChange={e => setListingType(e.target.value)}><option value="product">A physical product</option><option value="service">A service</option></select></label>
              <label>Offer title<input value={title} onChange={e => setTitle(e.target.value)} minLength={3} maxLength={140} placeholder="e.g. Handcrafted leather travel bag" required/></label>
              <label>Description<textarea className="offer-description-input" value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={4} placeholder="Describe what buyers should know about this offer."/></label>
              <label>Price ({business.default_currency})<input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" required/><small>Uses your business's default currency: {business.default_currency}.</small></label>
              {listingType === 'product' && <label>Available quantity <input type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Leave blank if not specified"/><small>Leave blank if quantity is not known yet.</small></label>}
              {error && <div className="auth-error" role="alert">{error}</div>}
              <button className="auth-submit" disabled={busy || loading}>{busy ? 'Saving your draft…' : 'Save offer as draft'} <span>↗</span></button>
            </form>
            <p className="business-footnote">Your offer is saved privately as a draft. It will not appear in public search or accept payments until publishing and seller-review controls are implemented.</p>
          </>}
        </>}
      </div>
    </section>
    <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/account">BACK TO YOUR SPACE ↑</Link></footer>
  </main>;
}
