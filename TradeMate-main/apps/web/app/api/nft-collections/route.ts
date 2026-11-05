import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'base', 'avalanche'];

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, collections: [], message: 'NFT collections are not connected. Add OPENSEA_API_KEY to the TradeMate web service environment.' }, { status: 503 });

  const incoming = new URL(request.url);
  const requestedChain = (incoming.searchParams.get('chain') || 'ethereum').trim().toLowerCase();
  const chain = SUPPORTED_CHAINS.includes(requestedChain) ? requestedChain : 'ethereum';
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 48), 1), 100);

  try {
    const params = new URLSearchParams({ chains: chain, sort_by: 'seven_days_volume', limit: String(limit) });
    const response = await fetch(`https://api.opensea.io/api/v2/collections/top?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ configured: true, collections: [], message: `OpenSea returned status ${response.status} while loading collections.` }, { status: response.status === 429 ? 429 : 502 });

    const payload = await response.json();
    const collections = (Array.isArray(payload.collections) ? payload.collections : []).map((entry: any) => ({
      slug: entry.collection || entry.slug || null,
      name: entry.name || entry.collection || 'Unnamed collection',
      image: entry.image_url || entry.banner_image_url || null,
      description: entry.description || '',
      chain: entry.chain || chain,
      floorPrice: typeof entry.floor_price === 'number' ? entry.floor_price : null,
      floorSymbol: entry.floor_price_symbol || 'ETH',
      totalVolume: typeof entry.total_volume === 'number' ? entry.total_volume : null,
      openseaUrl: entry.opensea_url || (entry.collection || entry.slug ? `https://opensea.io/collection/${encodeURIComponent(entry.collection || entry.slug)}` : null)
    })).filter((entry: any) => entry.slug);

    return NextResponse.json({ configured: true, chain, collections, next: payload.next || null, message: collections.length ? null : 'No collections were returned for this network.' });
  } catch {
    return NextResponse.json({ configured: true, collections: [], message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
  }
}
