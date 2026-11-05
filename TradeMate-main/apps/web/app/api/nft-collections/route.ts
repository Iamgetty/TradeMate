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

function cleanDescription(value: unknown): string {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/https?:\/\/\S+/gi, '').replace(/\bwww\.\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

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
      next: { revalidate: 60 }
    });
    if (!response.ok) return NextResponse.json({ configured: true, collections: [], message: `OpenSea returned status ${response.status} while loading collections.` }, { status: response.status === 429 ? 429 : 502 });

    const payload = await response.json();
    const entries = (Array.isArray(payload.collections) ? payload.collections : []).filter((entry: any) => entry.collection || entry.slug);
    const collections = await mapLimit(entries, 4, async (entry: any) => {
      const slug = String(entry.collection || entry.slug);
      let stats: any = null;
      try {
        const statsResponse = await fetch(`https://api.opensea.io/api/v2/collections/${encodeURIComponent(slug)}/stats`, {
          headers: { 'x-api-key': apiKey, accept: 'application/json' },
          next: { revalidate: 300 }
        });
        if (statsResponse.ok) stats = await statsResponse.json();
      } catch { /* Keep the collection visible when optional statistics are unavailable. */ }
      const total = stats?.total || {};
      const day = stats?.intervals?.find((interval: any) => interval.interval === 'one_day') || {};
      const floor = Number(total.floor_price ?? entry.floor_price);
      const totalVolume = Number(total.volume ?? entry.total_volume);
      const volume24h = Number(day.volume);
      const sales24h = Number(day.sales);
      return {
        slug,
        name: entry.name || slug,
        image: entry.image_url || entry.banner_image_url || null,
        description: cleanDescription(entry.description),
        chain: entry.chain || chain,
        floorPrice: Number.isFinite(floor) && floor > 0 ? floor : null,
        floorSymbol: total.floor_price_symbol || entry.floor_price_symbol || 'ETH',
        totalVolume: Number.isFinite(totalVolume) && totalVolume >= 0 ? totalVolume : null,
        totalVolumeSymbol: total.volume_symbol || entry.total_volume_symbol || 'ETH',
        volume24h: Number.isFinite(volume24h) && volume24h >= 0 ? volume24h : null,
        volume24hSymbol: day.volume_symbol || total.volume_symbol || 'ETH',
        sales24h: Number.isFinite(sales24h) && sales24h >= 0 ? sales24h : null,
        openseaUrl: entry.opensea_url || `https://opensea.io/collection/${encodeURIComponent(slug)}`
      };
    });

    return NextResponse.json({ configured: true, chain, collections, next: payload.next || null, message: collections.length ? null : 'No collections were returned for this network.' });
  } catch {
    return NextResponse.json({ configured: true, collections: [], message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
  }
}
