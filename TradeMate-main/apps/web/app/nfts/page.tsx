'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type Nft = { id: string; name: string; image: string | null; collection: string; chainId: number | null; contract: string | null; tokenId: string | null; price: number | null; currency: string | null; marketplace: string | null; marketplaceUrl: string | null; tokenUrl: string | null };
type ApiResult = { configured: boolean; items: Nft[]; message: string | null };

export default function NftMarketplacePage() {
  const [items, setItems] = useState<Nft[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '24', chain: 'ethereum' });
      if (term.trim()) params.set('search', term.trim());
      const response = await fetch('/api/nfts?' + params.toString(), { cache: 'no-store' });
      const result = await response.json() as ApiResult;
      setItems(result.items || []);
      setConfigured(Boolean(result.configured));
      setMessage(result.message || null);
    } catch {
      setItems([]);
      setMessage('We could not load NFT listings. Check your connection and try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(''); }, [load]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(search);
    void load(search);
  }

  return <main className="tm-nft-page">
    <header className="tm-nft-topbar">
      <Link href="/terminal" className="tm-nft-brand"><span>T↗</span><b>TradeMate<small> DIGITAL ASSETS</small></b></Link>
      <nav><Link href="/terminal">Terminal</Link><a className="active" href="#discover">NFT Marketplace</a><Link href="/messages">Messages</Link></nav>
      <Link className="tm-nft-back" href="/terminal">← Back to terminal</Link>
    </header>
    <section className="tm-nft-hero">
      <div className="tm-nft-kicker"><i/> MULTI-MARKETPLACE DISCOVERY</div>
      <h1>Discover digital<br/><em>ownership.</em></h1>
      <p>Explore NFT listings in one TradeMate experience. Browse collection details and available prices without bouncing between marketplace websites.</p>
      <div className="tm-nft-provider-line"><span>NFT DATA PROVIDER</span><b>OpenSea API</b><small>Ethereum search · live provider connection required</small></div>
      <div className="tm-nft-orbit" aria-hidden="true"><div className="tm-nft-orbit-ring ring-one"/><div className="tm-nft-orbit-ring ring-two"/><div className="tm-nft-orbit-core">◇</div><span className="orbit-label label-one">COLLECT</span><span className="orbit-label label-two">DISCOVER</span></div>
    </section>
    <section id="discover" className="tm-nft-discover">
      <div className="tm-nft-section-heading"><div><div className="tm-nft-kicker">THE AGGREGATED MARKET</div><h2>Explore NFTs <span>in one place.</span></h2></div><div className="tm-nft-chain-chip"><i/> Ethereum · listings</div></div>
      <form className="tm-nft-search" onSubmit={submitSearch}><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search NFT or collection name…" aria-label="Search NFTs"/>{search && <button type="button" onClick={() => { setSearch(''); setQuery(''); void load(''); }}>Clear</button>}<button className="submit" type="submit">Search ↗</button></form>
      <div className="tm-nft-results-head"><span>{query ? 'SEARCH RESULTS' : 'NFT SEARCH'}</span><span>{loading ? 'UPDATING…' : configured ? `${items.length} LISTINGS RETURNED` : 'PROVIDER NOT CONNECTED'}</span></div>
      {loading ? <div className="tm-nft-grid">{[1,2,3,4,5,6,7,8].map(n => <div className="tm-nft-skeleton" key={n}><div/><span/><span/></div>)}</div> :
        items.length ? <div className="tm-nft-grid">{items.map((nft) => <article className="tm-nft-card" key={nft.id}><div className="tm-nft-art">{nft.image ? <img src={nft.image} alt={nft.name} loading="lazy"/> : <div className="tm-nft-no-image">◇<small>NO PREVIEW</small></div>}<span className="tm-nft-live-tag">PROVIDER LISTING</span></div><div className="tm-nft-card-content"><small>{nft.collection}</small><h3>{nft.name}</h3><div className="tm-nft-price-row"><div><span>LISTING PRICE</span><b>{nft.price !== null ? `${nft.price.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${nft.currency || ''}` : 'Price unavailable'}</b></div><span className="tm-nft-chain-label">{nft.marketplace || 'Marketplace'}</span></div><div className="tm-nft-card-foot"><span>Chain ID: {nft.chainId ?? '—'}</span><span>Details ↗</span></div></div></article>)}</div> :
        <div className="tm-nft-empty"><div>◇</div><h3>{configured ? 'No listings to show' : 'Connect the NFT data source'}</h3><p>{message || 'Live listings will appear here when the provider is configured.'}</p>{!configured && <p className="tm-nft-setup-hint">Next setup step: add <code>OPENSEA_API_KEY</code> to the TradeMate web service environment. The key stays on the server and is never exposed to the browser.</p>}<button onClick={() => void load(query)}>Try again ↻</button></div>}
      <p className="tm-nft-disclaimer">Listings and prices are supplied by the connected provider and can change. TradeMate has not enabled NFT purchases yet; secure wallet signing, order execution and transaction verification are required before buying or selling.</p>
    </section>
    <footer className="tm-nft-footer"><span>TRADEMATE / NFT MARKETPLACE</span><span>DISCOVER HERE. NO REDIRECTION FOR BROWSING.</span><Link href="/terminal">Return to terminal ↗</Link></footer>
  </main>;
}
