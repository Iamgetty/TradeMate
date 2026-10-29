import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      items: [],
      message: 'NFT search is not connected yet. Add OPENSEA_API_KEY to the TradeMate web service environment.'
    }, { status: 503 });
  }

  const incoming = new URL(request.url);
  const search = incoming.searchParams.get('search')?.trim();
  const chain = incoming.searchParams.get('chain')?.trim() || 'ethereum';
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 24), 1), 48);

  if (!search) {
    return NextResponse.json({
      configured: true,
      items: [],
      message: 'Search for an NFT or collection to discover matching OpenSea results.'
    });
  }

  const params = new URLSearchParams({
    query: search.slice(0, 100),
    chains: chain,
    asset_types: 'nft',
    limit: String(Math.min(limit, 50))
  });

  try {
    const response = await fetch(`https://api.opensea.io/api/v2/search?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        items: [],
        message: `OpenSea returned status ${response.status}. Check the key, rate limits, and API access.`
      }, { status: response.status === 429 ? 429 : 502 });
    }

    const payload = await response.json();
    const results = Array.isArray(payload.results) ? payload.results : [];
    const items = results
      .filter((entry: any) => entry.type === 'nft' && entry.nft)
      .map((entry: any) => {
        const nft = entry.nft;
        const collection = nft.collection || {};
        const price = nft.price || nft.best_listing_price || null;
        const rawAmount = price?.value ?? price?.amount ?? null;
        const decimals = Number(price?.decimals ?? 0);
        const parsedAmount = rawAmount !== null && Number.isFinite(Number(rawAmount))
          ? Number(rawAmount) / (10 ** decimals)
          : null;
        return {
          id: [nft.chain || chain, nft.contract || '', nft.identifier || nft.token_id || nft.name || 'nft'].join(':'),
          name: nft.name || `NFT #${nft.identifier || 'unknown'}`,
          image: nft.image_url || nft.display_image_url || nft.image || null,
          collection: typeof collection === 'string' ? collection : (collection.name || collection.slug || 'OpenSea collection'),
          chainId: null,
          contract: nft.contract || null,
          tokenId: nft.identifier || nft.token_id || null,
          price: parsedAmount,
          currency: price?.currency || null,
          marketplace: 'OpenSea',
          marketplaceUrl: nft.opensea_url || null,
          tokenUrl: nft.opensea_url || null
        };
      });

    return NextResponse.json({
      configured: true,
      items,
      message: items.length ? null : 'No NFT matches were returned. Try another NFT or collection name.'
    });
  } catch {
    return NextResponse.json({
      configured: true,
      items: [],
      message: 'Could not reach OpenSea. Please try again shortly.'
    }, { status: 502 });
  }
}
