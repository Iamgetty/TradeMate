import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

function parsePrice(price: any): { amount: number | null; currency: string | null } {
  const current = price?.current || price?.price_per_item || price?.price || price;
  const raw = current?.value ?? current?.amount ?? current?.current_value ?? null;
  const decimals = Number(current?.decimals ?? price?.decimals ?? 0);
  const amount = raw !== null && Number.isFinite(Number(raw)) && Number.isFinite(decimals) ? Number(raw) / (10 ** decimals) : null;
  return { amount: amount !== null && amount > 0 ? amount : null, currency: current?.currency || price?.currency || null };
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, items: [], message: 'NFT search is not connected yet. Add OPENSEA_API_KEY to the TradeMate web service environment.' }, { status: 503 });

  const incoming = new URL(request.url);
  const search = incoming.searchParams.get('search')?.trim();
  const supportedChains = ['ethereum', 'polygon', 'arbitrum', 'base', 'avalanche'];
  const requestedChain = incoming.searchParams.get('chain')?.trim().toLowerCase() || 'ethereum';
  const chain = supportedChains.includes(requestedChain) ? requestedChain : 'ethereum';
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 24), 1), 48);
  if (!search) return NextResponse.json({ configured: true, items: [], message: 'Search for an NFT or collection to discover matching OpenSea results.' });

  const params = new URLSearchParams({ query: search.slice(0, 100), chains: chain, asset_types: 'nft', limit: String(Math.min(limit, 50)) });
  try {
    const response = await fetch(`https://api.opensea.io/api/v2/search?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' }, next: { revalidate: 30 }
    });
    if (!response.ok) return NextResponse.json({ configured: true, items: [], message: `OpenSea returned status ${response.status}. Check the key, rate limits, and API access.` }, { status: response.status === 429 ? 429 : 502 });

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    const items = results.filter((entry: any) => entry.type === 'nft' && entry.nft).map((entry: any) => {
      const nft = entry.nft;
      const collection = nft.collection || {};
      const parsed = parsePrice(nft.price || nft.best_listing_price || nft.best_listing || null);
      const collectionSlug = typeof collection === 'string' ? collection.toLowerCase().trim().replace(/\s+/g, '-') : (collection.slug || null);
      return {
        id: [nft.chain || chain, nft.contract || '', nft.identifier || nft.token_id || nft.name || 'nft'].join(':'),
        name: nft.name || `NFT #${nft.identifier || 'unknown'}`,
        image: nft.image_url || nft.display_image_url || nft.image || null,
        collection: typeof collection === 'string' ? collection : (collection.name || collection.slug || 'OpenSea collection'),
        collectionSlug, chain: nft.chain || chain, chainId: null,
        contract: nft.contract || null, tokenId: nft.identifier || nft.token_id || null,
        price: parsed.amount, currency: parsed.currency, marketplace: 'OpenSea',
        marketplaceUrl: nft.opensea_url || null, tokenUrl: nft.opensea_url || null
      };
    });

    const pricedItems = await mapLimit(items, 4, async (item: any) => {
      if (typeof item.price === 'number' || !item.collectionSlug || !item.tokenId) return item;
      try {
        const listingResponse = await fetch(`https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(item.collectionSlug)}/nfts/${encodeURIComponent(item.tokenId)}/best`, {
          headers: { 'x-api-key': apiKey, accept: 'application/json' }, next: { revalidate: 30 }
        });
        if (!listingResponse.ok) return item;
        const listing = await listingResponse.json();
        const parsed = parsePrice(listing?.price_per_item || listing?.price?.current || null);
        return { ...item, price: parsed.amount, currency: parsed.currency || item.currency };
      } catch { return item; }
    });

    const slugs = pricedItems.map((item: any) => item.collectionSlug).filter((slug: any, index: number, all: any[]) => Boolean(slug) && all.indexOf(slug) === index);
    const stats = await mapLimit(slugs, 4, async (slug: string) => {
      try {
        const statsResponse = await fetch(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`, {
          headers: { 'x-api-key': apiKey, accept: 'application/json' }, next: { revalidate: 300 }
        });
        if (!statsResponse.ok) return [slug, null] as const;
        const value = await statsResponse.json();
        const day = value?.intervals?.find((interval: any) => interval.interval === 'one_day') || {};
        return [slug, { sales24h: typeof day.sales === 'number' ? day.sales : null, volume24h: typeof day.volume === 'number' ? day.volume : null, volume24hSymbol: day.volume_symbol || value?.total?.volume_symbol || 'ETH' }] as const;
      } catch { return [slug, null] as const; }
    });
    const statsBySlug = new Map(stats.filter((entry) => entry[1]).map((entry) => entry as [string, { sales24h: number | null; volume24h: number | null; volume24hSymbol: string }]));
    const enrichedItems = pricedItems.map((item: any) => ({
      ...item, sales24h: statsBySlug.get(item.collectionSlug)?.sales24h ?? null,
      volume24h: statsBySlug.get(item.collectionSlug)?.volume24h ?? null,
      volume24hSymbol: statsBySlug.get(item.collectionSlug)?.volume24hSymbol ?? 'ETH'
    }));
    return NextResponse.json({ configured: true, items: enrichedItems, message: enrichedItems.length ? null : 'No NFT matches were returned. Try another NFT or collection name.' });
  } catch {
    return NextResponse.json({ configured: true, items: [], message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
  }
}
