'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type User = { id: string; email: string; display_name: string };
type MainTab = 'Home' | 'Markets' | 'Trade' | 'P2P' | 'Wallets';
type TradeMode = 'Book' | 'Trade';
type BookRow = { price: number; quantity: number; total: number; side: 'buy' | 'sell' };
type RecentTrade = { price: number; quantity: number; time: string; side: 'buy' | 'sell' };
type MarketData = { book: BookRow[]; trades: RecentTrade[]; updatedAt: Date } | null;

const tabs: { label: MainTab; icon: string }[] = [
  { label: 'Home', icon: '⌂' },
  { label: 'Markets', icon: '▥' },
  { label: 'Trade', icon: '⇄' },
  { label: 'P2P', icon: '↔' },
  { label: 'Wallets', icon: '◈' },
];
const markets = [
  { name: 'Crypto', symbol: '₿', description: 'Tokens, pairs and market data' },
  { name: 'Products', symbol: '▦', description: 'Physical and digital goods' },
  { name: 'Services', symbol: '✳', description: 'Services offered by providers' },
  { name: 'NFTs', symbol: '◇', description: 'Digital collectibles and listings' },
  { name: 'Software', symbol: '⌘', description: 'Software, SaaS and source code' },
  { name: 'Businesses', symbol: '▤', description: 'Businesses and digital ventures' },
];
const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
export default function TerminalPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<MainTab>('Home');
  const [tradeMode, setTradeMode] = useState<TradeMode>('Book');
  const [selectedMarket, setSelectedMarket] = useState('Crypto');
  const [selectedPair, setSelectedPair] = useState('BTC/USDT');
  const [showPairMenu, setShowPairMenu] = useState(false);
  const [showMarketMenu, setShowMarketMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [p2pSide, setP2pSide] = useState<'Buy' | 'Sell'>('Buy');
  const [p2pCoin, setP2pCoin] = useState('USDT');
  const [p2pFiat, setP2pFiat] = useState('NGN');
  const [p2pPayment, setP2pPayment] = useState('All payment methods');
  const [p2pAmount, setP2pAmount] = useState('');
  const [p2pFiltersOpen, setP2pFiltersOpen] = useState(false);
  const [marketData, setMarketData] = useState<MarketData>(null);
  const [marketDataLoading, setMarketDataLoading] = useState(false);
  const [marketDataError, setMarketDataError] = useState('');

  const binanceSymbol = selectedPair.replace('/', '').toUpperCase();
  const quoteAsset = selectedPair.split('/')[1] || 'USDT';
  const baseAsset = selectedPair.split('/')[0] || 'BTC';

  useEffect(() => {
    if (activeTab !== 'Trade' || selectedMarket !== 'Crypto') return;
    let cancelled = false;
    let inFlight = false;
    const loadMarketData = async () => {
      if (inFlight) return;
      inFlight = true;
      setMarketDataLoading(true);
      try {
        const [depthResponse, tradesResponse] = await Promise.all([
          fetch(`https://api.binance.com/api/v3/depth?symbol=${encodeURIComponent(binanceSymbol)}&limit=10`, { cache: 'no-store' }),
          fetch(`https://api.binance.com/api/v3/trades?symbol=${encodeURIComponent(binanceSymbol)}&limit=10`, { cache: 'no-store' }),
        ]);
        if (!depthResponse.ok || !tradesResponse.ok) throw new Error('Live public market data is unavailable for this pair.');
        const depth = await depthResponse.json();
        const trades = await tradesResponse.json();
        if (!Array.isArray(depth.bids) || !Array.isArray(depth.asks) || !Array.isArray(trades)) {
          throw new Error('The market data provider returned an unexpected response.');
        }
        const mapRows = (rows: string[][], side: 'buy' | 'sell'): BookRow[] => rows.slice(0, 10).map(row => {
          const price = Number(row[0]);
          const quantity = Number(row[1]);
          return { price, quantity, total: price * quantity, side };
        });
        const book = [
          ...mapRows(depth.asks.slice(0, 10).reverse(), 'sell'),
          ...mapRows(depth.bids.slice(0, 10), 'buy'),
        ];
        const recent: RecentTrade[] = trades.slice().reverse().map((trade: { price: string; qty: string; time: number; isBuyerMaker: boolean }) => ({
          price: Number(trade.price),
          quantity: Number(trade.qty),
          time: new Date(trade.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          side: trade.isBuyerMaker ? 'sell' : 'buy',
        }));
        if (!cancelled) {
          setMarketData({ book, trades: recent, updatedAt: new Date() });
          setMarketDataError('');
        }
      } catch (error) {
        if (!cancelled) setMarketDataError(error instanceof Error ? error.message : 'Unable to load live market data.');
      } finally {
        inFlight = false;
        if (!cancelled) setMarketDataLoading(false);
      }
    };
    setMarketData(null);
    setMarketDataError('');
    void loadMarketData();
    const interval = window.setInterval(loadMarketData, 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeTab, selectedMarket, binanceSymbol]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async r => { if (!r.ok) { router.replace('/auth?mode=login'); return null; } return r.json(); })
      .then(d => { if (!cancelled && d?.user) setUser(d.user); })
      .catch(() => { if (!cancelled) router.replace('/auth?mode=login'); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [router]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    router.replace('/');
  }

  const filteredMarkets = useMemo(() => markets.filter(m => m.name.toLowerCase().includes(search.toLowerCase())), [search]);

  if (checking || !user) return <main className="tm-terminal-loading"><div className="tm-terminal-loader">TM</div><p>Opening TradeMate…</p></main>;

  return <main className="tm-mobile-app">
    <header className="tm-mobile-header">
      <Link href="/terminal" className="tm-mobile-brand"><span className="tm-mobile-logo">T↗</span><span>TradeMate<small>YOUR MULTI-MARKETPLACE</small></span></Link>
      <div className="tm-mobile-header-actions">
        <button aria-label="Search markets" onClick={() => { setActiveTab('Markets'); setTimeout(() => document.getElementById('tm-market-search')?.focus(), 50); }}>⌕</button>
        <button aria-label="Notifications" onClick={() => router.push('/messages')}>♧</button>
        <button className="tm-mobile-user" aria-label="Account menu" onClick={() => setProfileOpen(v => !v)}>{user.display_name.trim().charAt(0).toUpperCase()}</button>
        {profileOpen && <div className="tm-mobile-profile"><b>{user.display_name}</b><small>{user.email}</small><Link href="/account">Account & assets</Link><button onClick={signOut}>Sign out</button></div>}
      </div>
    </header>

    <div className="tm-mobile-content">
      {activeTab === 'Home' && <>
        <section className="tm-mobile-welcome"><div><span className="tm-mobile-eyebrow">YOUR MARKETPLACE, CONNECTED</span><h1>Explore more.<br/><em>Trade your way.</em></h1><p>Crypto, products, services and digital opportunities in one place.</p></div><div className="tm-mobile-home-mark" aria-hidden="true"><span>↗</span><i/><b/></div></section>
        <div className="tm-mobile-search" onClick={() => setActiveTab('Markets')}><span>⌕</span><span>Search tokens, products, services…</span><kbd>/</kbd></div>
        <div className="tm-mobile-section-title"><div><small>QUICK ACCESS</small><h2>Explore TradeMate</h2></div><span>06 MARKETS</span></div>
        <div className="tm-mobile-market-grid">{markets.map(m => <button key={m.name} className="tm-mobile-market-card" onClick={() => { setSelectedMarket(m.name); setActiveTab('Markets'); }}><span className="tm-mobile-market-icon">{m.symbol}</span><b>{m.name}</b><small>{m.description}</small><i>↗</i></button>)}</div>
        <section className="tm-mobile-ad"><span>FEATURED SPACE</span><b>Your promotion could appear here</b><small>Reserved for relevant listings, campaigns and announcements.</small><div className="tm-mobile-ad-mark">TM<span> / FEATURE</span></div></section>
        <div className="tm-mobile-section-title"><div><small>DISCOVER</small><h2>Across every market</h2></div><button onClick={() => setActiveTab('Markets')}>View all ↗</button></div>
        <div className="tm-mobile-discovery-list">{markets.map((m, i) => <button key={m.name} onClick={() => { setSelectedMarket(m.name); setActiveTab('Markets'); }}><span className="tm-mobile-discovery-icon">{m.symbol}</span><span><b>{m.name}</b><small>{['Top movers and newly listed tokens','Popular listings and new products','Featured providers and new services','Trending collections and new NFTs','Software and SaaS opportunities','Businesses and digital ventures'][i]}</small></span><i>›</i></button>)}</div>
      </>}

      {activeTab === 'Markets' && <>
        <div className="tm-mobile-page-heading"><span className="tm-mobile-eyebrow">DISCOVER OPPORTUNITIES</span><h1>Markets</h1><p>Choose a market, then select the product you want to explore.</p></div>
        <label className="tm-mobile-search tm-mobile-search-field"><span>⌕</span><input id="tm-market-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search all markets and products"/></label>
        <div className="tm-mobile-market-grid">{filteredMarkets.map(m => <button key={m.name} className={'tm-mobile-market-card'+(selectedMarket === m.name ? ' selected' : '')} onClick={() => setSelectedMarket(m.name)}><span className="tm-mobile-market-icon">{m.symbol}</span><b>{m.name}</b><small>{m.description}</small><i>↗</i></button>)}</div>
        <section className="tm-mobile-selected-market"><div><small>SELECTED MARKET</small><h2>{selectedMarket}</h2><p>{selectedMarket === 'Crypto' ? 'Select a pair to open its book and recent trades.' : 'Choose a listing to view its available details and transaction options.'}</p></div><button onClick={() => { setActiveTab('Trade'); setTradeMode('Book'); }}>Open {selectedMarket} ↗</button></section>
        {selectedMarket === 'Crypto' && <div className="tm-mobile-pair-list">{pairs.map((pair, i) => <button key={pair} onClick={() => { setSelectedPair(pair); setActiveTab('Trade'); setTradeMode('Book'); }}><span className="tm-mobile-coin">{['₿','Ξ','◎'][i]}</span><span><b>{pair}</b><small>Spot market · data connection required</small></span><i>›</i></button>)}</div>}
      </>}

      {activeTab === 'Trade' && <>
        <section className="tm-mobile-trade-head"><button className="tm-mobile-market-back" onClick={() => setActiveTab('Markets')}>‹ Markets</button><div className="tm-mobile-pair-selector"><button onClick={() => setShowPairMenu(v => !v)}><span className="tm-mobile-coin">₿</span><span><b>{selectedPair}</b><small>{selectedMarket} market</small></span><i>⌄</i></button>{showPairMenu && <div className="tm-mobile-dropdown">{(selectedMarket === 'Crypto' ? pairs : markets.filter(m => m.name === selectedMarket).map(m => m.name)).map(p => <button key={p} onClick={() => { if (pairs.includes(p)) setSelectedPair(p); setShowPairMenu(false); }}>{p}</button>)}</div>}</div><span className="tm-mobile-data-note">{selectedMarket === 'Crypto' ? 'PUBLIC LIVE DATA' : 'DATA NOT AVAILABLE'}</span></section>
        <div className="tm-mobile-trade-tabs" role="tablist" aria-label="Trade data view"><button role="tab" aria-selected={tradeMode === 'Book'} className={tradeMode === 'Book' ? 'active' : ''} onClick={() => setTradeMode('Book')}>Book</button><button role="tab" aria-selected={tradeMode === 'Trade'} className={tradeMode === 'Trade' ? 'active' : ''} onClick={() => setTradeMode('Trade')}>Trade</button></div>
        {selectedMarket !== 'Crypto' ? <section className="tm-mobile-empty-state"><span>▤</span><b>{selectedMarket} trading data is not connected</b><p>TradeMate will show this market's own listings and transaction structure here. Crypto order-book data will not be substituted for it.</p><button onClick={() => setActiveTab('Markets')}>Choose another market</button></section> : tradeMode === 'Book' ? <section className="tm-mobile-book-panel"><div className="tm-mobile-table-head"><span>Price ({quoteAsset})</span><span>Quantity ({baseAsset})</span><span>Total</span></div>{marketData?.book?.length ? <><div className="tm-mobile-book-side sell">{marketData.book.filter(r => r.side === 'sell').map((r, i) => <div className="tm-mobile-data-row" key={i}><b>{r.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</b><span>{r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><span>{r.total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>)}</div><div className="tm-mobile-mid-price"><div><b>{marketData.book.find(r => r.side === 'buy')?.price.toLocaleString(undefined, { maximumFractionDigits: 8 }) || '—'}</b><span>Public exchange reference · not TradeMate orders</span></div><span>{quoteAsset}</span></div><div className="tm-mobile-book-side buy">{marketData.book.filter(r => r.side === 'buy').map((r, i) => <div className="tm-mobile-data-row" key={i}><b>{r.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</b><span>{r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><span>{r.total.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span></div>)}</div></> : <div className="tm-mobile-market-loading">{marketDataLoading ? 'Connecting to public market data…' : 'Order book is not available yet.'}</div>}<div className="tm-mobile-book-legend"><span><i className="green-dot"/> Buy bids</span><span><i className="red-dot"/> Sell asks</span></div>{marketData?.updatedAt && <p className="tm-mobile-preview-disclaimer">Updated {marketData.updatedAt.toLocaleTimeString()} · Public Binance market data. These are not TradeMate user orders.</p>}{marketDataError && <p className="tm-mobile-preview-disclaimer">{marketDataError} <button onClick={() => setActiveTab('Markets')}>Change pair</button></p>}</section> : <section className="tm-mobile-recent-panel"><div className="tm-mobile-table-head"><span>Price ({quoteAsset})</span><span>Quantity ({baseAsset})</span><span>Time</span></div>{marketData?.trades?.length ? marketData.trades.map((r, i) => <div className={'tm-mobile-data-row '+r.side} key={i}><b>{r.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</b><span>{r.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span><span>{r.time}</span></div>) : <div className="tm-mobile-market-loading">{marketDataLoading ? 'Loading recent public trades…' : 'Recent trades are not available yet.'}</div>}<p className="tm-mobile-preview-disclaimer">Actual public exchange trades, refreshed every 5 seconds. These are not TradeMate P2P transactions.{marketDataError ? ' ' + marketDataError : ''}</p></section>}
        <div className="tm-mobile-trade-footer"><span>BOOK & TRADE ONLY</span><span>Chart panel intentionally excluded</span></div>
      </>}

      {activeTab === 'P2P' && <><div className="tm-mobile-page-heading"><span className="tm-mobile-eyebrow">PEER-TO-PEER MARKETPLACE</span><h1>Buy & sell directly.</h1><p>Compare offers, payment methods and advertiser terms before trading.</p></div><div className="tm-mobile-p2p-switch"><button className={p2pSide === 'Buy' ? 'active' : ''} onClick={() => setP2pSide('Buy')}>Buy</button><button className={p2pSide === 'Sell' ? 'active' : ''} onClick={() => setP2pSide('Sell')}>Sell</button></div><div className="tm-mobile-p2p-filters"><label><span>Coin</span><select aria-label="Coin" value={p2pCoin} onChange={e => setP2pCoin(e.target.value)}><option>USDT</option><option>BTC</option><option>ETH</option></select></label><label><span>Fiat</span><select aria-label="Fiat currency" value={p2pFiat} onChange={e => setP2pFiat(e.target.value)}><option>NGN</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><button onClick={() => setP2pFiltersOpen(v => !v)}>Filters {p2pFiltersOpen ? '⌃' : '⌄'}</button></div>{p2pFiltersOpen && <section className="tm-mobile-p2p-filter-panel"><label>Amount ({p2pFiat})<input inputMode="decimal" type="number" min="0" placeholder="Enter amount" value={p2pAmount} onChange={e => setP2pAmount(e.target.value)}/></label><label>Payment method<select value={p2pPayment} onChange={e => setP2pPayment(e.target.value)}><option>All payment methods</option><option>Bank transfer</option><option>Mobile money</option><option>Other</option></select></label><button onClick={() => { setP2pAmount(''); setP2pPayment('All payment methods'); }}>Reset filters</button></section>}<div className="tm-mobile-p2p-summary"><div><small>YOU WANT TO</small><b>{p2pSide} {p2pCoin}</b></div><div><small>PAY WITH</small><b>{p2pPayment === 'All payment methods' ? 'Any method' : p2pPayment}</b></div><div><small>FIAT CURRENCY</small><b>{p2pFiat}</b></div></div><section className="tm-mobile-empty-state"><span>⇄</span><b>{p2pSide === 'Buy' ? 'Buy' : 'Sell'} {p2pCoin} with {p2pFiat}</b><p>{p2pAmount ? 'Amount filter: ' + Number(p2pAmount).toLocaleString() + ' ' + p2pFiat + '. ' : ''}{p2pPayment !== 'All payment methods' ? 'Payment filter: ' + p2pPayment + '. ' : ''}TradeMate’s verified P2P advertiser offers and secure order flow are not connected yet. No sample prices or sellers are shown as real.</p><Link href="/offers">Manage marketplace offers ↗</Link></section><Link className="tm-mobile-full-link" href="/messages">P2P orders & messages ↗</Link></>}

      {activeTab === 'Wallets' && <><div className="tm-mobile-page-heading"><span className="tm-mobile-eyebrow">YOUR ASSETS</span><h1>Wallets</h1><p>One place for supported assets, deposits and transaction history.</p></div><section className="tm-mobile-wallet-card"><small>TOTAL BALANCE</small><h2>— — —</h2><span>Balance data not connected</span><div><button onClick={() => router.push('/account')}>Deposit</button><button onClick={() => router.push('/account')}>History</button></div></section><div className="tm-mobile-section-title"><div><small>WALLET FOUNDATION</small><h2>Asset management</h2></div></div><div className="tm-mobile-wallet-list"><div><span>◈</span><b>Supported assets & networks</b><small>Only networks verified by the wallet integration.</small></div><div><span>⇄</span><b>Transfers and P2P settlement</b><small>Transaction state must be confirmed by the relevant system.</small></div><div><span>▤</span><b>Deposit & withdrawal history</b><small>Blockchain-confirmed status, not just local records.</small></div></div><Link className="tm-mobile-full-link" href="/account">Open account assets ↗</Link></>}
    </div>

    <nav className="tm-mobile-bottom-nav" aria-label="Main navigation">{tabs.map(t => <button key={t.label} className={activeTab === t.label ? 'active' : ''} onClick={() => setActiveTab(t.label)}><span>{t.icon}</span><small>{t.label}</small></button>)}</nav>
  </main>;
}
