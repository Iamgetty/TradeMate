'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Offer = {
  id: string;
  title: string;
  description: string | null;
  listing_type: 'product' | 'service';
  price_minor_units: string;
  currency_code: string;
  country_code: string;
  quantity_available: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  seller_name: string;
};

const money = (minor: string, currency: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(minor) / 100); }
  catch { return currency + ' ' + (Number(minor) / 100).toFixed(2); }
};

export default function MyOffersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listingType, setListingType] = useState<'product' | 'service'>('product');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  async function loadOffers() {
    setLoading(true);
    setError('');
    try {
      const me = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (!me.ok) { router.replace('/auth?mode=login'); return; }
      const response = await fetch('/api/market/listings/mine', { credentials: 'include', cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace('/auth?mode=login'); return; }
      if (!response.ok) throw new Error(result.message || 'Could not load your offers.');
      setOffers(Array.isArray(result.data) ? result.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to TradeMate.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOffers(); }, []);

  function startEditing(offer: Offer) {
    setActionError('');
    setEditingId(offer.id);
    setTitle(offer.title);
    setDescription(offer.description || '');
    setListingType(offer.listing_type);
    setPrice((Number(offer.price_minor_units) / 100).toFixed(2));
    setQuantity(offer.quantity_available == null ? '' : String(offer.quantity_available));
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setBusyId(editingId);
    setActionError('');
    try {
      const response = await fetch('/api/market/listings/' + encodeURIComponent(editingId), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, listingType, price, quantityAvailable: listingType === 'product' && quantity.trim() !== '' ? quantity : null }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace('/auth?mode=login'); return; }
      if (!response.ok) throw new Error(result.message || 'Could not update this draft.');
      setEditingId('');
      await loadOffers();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update this draft.');
    } finally {
      setBusyId('');
    }
  }

  async function deleteOffer(offer: Offer) {
    if (offer.status !== 'draft') return;
    if (!window.confirm('Delete the draft “' + offer.title + '”? This cannot be undone.')) return;
    setBusyId(offer.id);
    setActionError('');
    try {
      const response = await fetch('/api/market/listings/' + encodeURIComponent(offer.id), { method: 'DELETE', credentials: 'include' });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) { router.replace('/auth?mode=login'); return; }
      if (!response.ok) throw new Error(result.message || 'Could not delete this draft.');
      setOffers(current => current.filter(item => item.id !== offer.id));
      if (editingId === offer.id) setEditingId('');
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete this draft.');
    } finally {
      setBusyId('');
    }
  }

  return <main className="web3-shell account-shell">
    <header className="top-nav">
      <Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link>
      <Link className="nav-pill" href="/account">My space ↗</Link>
    </header>
    <section className="account-wrap offers-wrap">
      <div className="section-kicker"><span/> SELLER WORKSPACE / YOUR OFFERS</div>
      <h1>Your offers.<br/><span>Your next move.</span></h1>
      <p className="account-lead">Keep track of the products and services you have prepared for the global marketplace.</p>
      <div className="offers-toolbar">
        <div><span className="offers-count">{offers.length.toString().padStart(2, '0')}</span><span className="offers-count-label">SAVED OFFERS</span></div>
        <Link className="cta-primary" href="/offers/new">＋ Create an offer</Link>
      </div>
      {actionError && <div className="auth-error offers-action-error" role="alert">{actionError}</div>}
      {loading ? <div className="market-state"><div className="empty-orb3"><span>◈</span></div><h3>Gathering your offers…</h3><p>Checking your seller workspace.</p></div>
      : error ? <div className="market-state"><div className="state-orb">!</div><h3>Offers could not load</h3><p>{error}</p><button className="retry-btn" onClick={() => void loadOffers()}>Try again ↻</button></div>
      : offers.length === 0 ? <div className="offers-empty">
        <div className="empty-orb3"><span>↗</span></div>
        <div className="section-kicker"><span/> A CLEAN SLATE</div>
        <h2>Your first offer starts here.</h2>
        <p>When you save a product or service, it will appear here with its price, type, and current status.</p>
        <Link className="cta-primary detail-back" href="/offers/new">Create your first offer ↗</Link>
      </div> : <div className="offers-list">
        {offers.map((offer, index) => <article className="offer-row" key={offer.id}>
          <div className="offer-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="offer-row-main">
            <div className="offer-row-meta"><span>{offer.listing_type === 'product' ? 'PHYSICAL PRODUCT' : 'SERVICE'}</span><span className={'offer-status offer-status-' + offer.status.toLowerCase()}>{offer.status.replaceAll('_', ' ')}</span></div>
            {editingId === offer.id ? <form className="offer-edit-form" onSubmit={saveEdit}>
              <label>Offer title<input value={title} onChange={e => setTitle(e.target.value)} minLength={3} maxLength={140} required/></label>
              <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={5000} rows={3}/></label>
              <label>Offer type<select value={listingType} onChange={e => setListingType(e.target.value as 'product' | 'service')}><option value="product">Product</option><option value="service">Service</option></select></label>
              <label>Price ({offer.currency_code})<input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required/></label>
              {listingType === 'product' && <label>Quantity<input type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Leave blank if unknown"/></label>}
              <div className="offer-actions"><button className="offer-action-primary" type="submit" disabled={busyId === offer.id}>{busyId === offer.id ? 'Saving…' : 'Save changes'}</button><button className="offer-action-secondary" type="button" onClick={() => { setEditingId(''); setActionError(''); }}>Cancel</button></div>
            </form> : <>
              <h2>{offer.title}</h2>
              <p>{offer.description || 'No description added yet.'}</p>
              <small>{offer.country_code} · Created {new Date(offer.created_at).toLocaleDateString()}</small>
            </>}
          </div>
          <div className="offer-row-price"><strong>{money(offer.price_minor_units, offer.currency_code)}</strong><span>{offer.quantity_available == null ? 'Quantity not set' : 'Qty ' + offer.quantity_available}</span>
            {offer.status === 'draft' && editingId !== offer.id && <div className="offer-actions offer-actions-stack"><button className="offer-action-secondary" type="button" onClick={() => startEditing(offer)}>Edit draft</button><button className="offer-action-danger" type="button" disabled={busyId === offer.id} onClick={() => void deleteOffer(offer)}>{busyId === offer.id ? 'Working…' : 'Delete draft'}</button></div>}
          </div>
        </article>)}
      </div>}
      <Link className="account-secondary-link" href="/account">← Back to your space</Link>
    </section>
    <footer className="footer3"><Link className="wordmark" href="/"><span className="logo-glyph">T<span>↗</span></span><span>TradeMate</span></Link><span>TRADE SMART. TRADE DIRECT.</span><Link href="/#top">BACK TO MARKET ↑</Link></footer>
  </main>;
}
