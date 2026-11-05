import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'base', 'avalanche'];

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

function parseListing(best: any): { price: number | null; currency: string | null } {
  const current = best?.price_per_item || best?.price?.current || best?.price?.price_per_item || null;
  const value = current?.value ?? current?.amount ?? null;
  const decimals = Number(current?.decimals ?? 0);
  const parsed = value !== null && Number.isFinite(Number(value)) && Number.isFinite(decimals) ? Number(value) / (10 ** decimals) : null;
  return { price: parsed !== null && parsed > 0 ? parsed : null, currency: current?.currency || null };
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, items: [], message: 'NFT listings are not connected. Add OPENSEA_API_KEY to the TradeMate web service environment.' }, { status: 503 });

  const incoming = new URL(request.url);
  const slug = (incoming.searchParams.get('slug') || '').trim();
  const requestedChain = (incoming.searchParams.get('chain') || 'ethereum').trim().toLowerCase();
  const chain = SUPPORTED_CHAINS.includes(requestedChain) ? requestedChain : 'ethereum';
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 24), 1), 50);
  const lite = incoming.searchParams.get('lite') === '1';
  if (!slug) return NextResponse.json({ configured: true, items: [], message: 'Choose a collection to view its NFTs.' }, { status: 400 });

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`https://api.opensea.io/api/v2/collection/${encodeURIComponent(slug)}/nfts?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return NextResponse.json({ configured: true, items: [], message: `OpenSea returned status ${response.status} while loading this collection.` }, { status: response.status === 429 ? 429 : 502 });

    const payload = await response.json();
    const rawNfts = Array.isArray(payload.nfts) ? payload.nfts : [];
    const [stats, items] = await Promise.all([
      (async () => {
        try {
          const statsResponse = await fetch(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`, {
            headers: { 'x-api-key': apiKey, accept: 'application/json' },
            next: { revalidate: 300 },
            signal: AbortSignal.timeout(8000)
          });
          return statsResponse.ok ? await statsResponse.json() : null;
        } catch { return null; }
      })(),
      mapLimit(rawNfts, 4, async (nft: any) => {
        let listing: any = null;
        if (!lite) try {
          const tokenId = String(nft.identifier || nft.token_id || '');
          const listingResponse = await fetch(`https://api.opensea.io/api/v2/listings/collection/${encodeURIComponent(slug)}/nfts/${encodeURIComponent(tokenId)}/best`, {
            headers: { 'x-api-key': apiKey, accept: 'application/json' },
            next: { revalidate: 30 },
            signal: AbortSignal.timeout(8000)
          });
          if (listingResponse.ok) listing = await listingResponse.json();
        } catch { /* Unlisted NFTs correctly retain a null price. */ }
        const parsed = parseListing(listing);
        return {
          id: [chain, nft.contract || '', nft.identifier || nft.token_id || 'nft'].join(':'),
          name: nft.name || `NFT #${nft.identifier || 'unknown'}`,
          image: nft.image_url || nft.display_image_url || nft.image || null,
          collection: nft.collection || slug,
          collectionSlug: slug,
          chain,
          contract: nft.contract || null,
          tokenId: nft.identifier || nft.token_id || null,
          price: parsed.price,
          currency: parsed.currency,
          marketplace: 'OpenSea',
          marketplaceUrl: nft.opensea_url || `https://opensea.io/collection/${encodeURIComponent(slug)}`
        };
      })
    ]);
    const day = stats?.intervals?.find((interval: any) => interval.interval === 'one_day') || {};
    const sales24h = typeof day.sales === 'number' ? day.sales : null;
    const volume24h = typeof day.volume === 'number' ? day.volume : null;
    const enrichedItems = items.map((item: any) => ({
      ...item, sales24h, volume24h,
      volume24hSymbol: day.volume_symbol || stats?.total?.volume_symbol || 'ETH'
    }));

    return NextResponse.json({ configured: true, slug, items: enrichedItems, next: payload.next || null, message: enrichedItems.length ? null : 'No NFTs were returned for this collection.' });
  } catch {
    return NextResponse.json({ configured: true, items: [], message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
  }
}
