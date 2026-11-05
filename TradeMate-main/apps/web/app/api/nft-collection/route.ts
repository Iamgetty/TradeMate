import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'base', 'avalanche'];

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, items: [], message: 'NFT listings are not connected. Add OPENSEA_API_KEY to the TradeMate web service environment.' }, { status: 503 });

  const incoming = new URL(request.url);
  const slug = (incoming.searchParams.get('slug') || '').trim();
  const requestedChain = (incoming.searchParams.get('chain') || 'ethereum').trim().toLowerCase();
  const chain = SUPPORTED_CHAINS.includes(requestedChain) ? requestedChain : 'ethereum';
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 24), 1), 50);
  if (!slug) return NextResponse.json({ configured: true, items: [], message: 'Choose a collection to view its NFTs.' }, { status: 400 });

  try {
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await fetch(`https://api.opensea.io/api/v2/collection/${encodeURIComponent(slug)}/nfts?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) return NextResponse.json({ configured: true, items: [], message: `OpenSea returned status ${response.status} while loading this collection.` }, { status: response.status === 429 ? 429 : 502 });

    const payload = await response.json();
    const items = (Array.isArray(payload.nfts) ? payload.nfts : []).map((nft: any) => {
      const rawPrice = nft.price || nft.best_listing || null;
      const current = rawPrice?.current || rawPrice?.price || rawPrice;
      const amount = current?.value ?? current?.amount ?? null;
      const decimals = Number(current?.decimals || 0);
      const parsedPrice = amount !== null && Number.isFinite(Number(amount)) ? Number(amount) / (10 ** decimals) : null;
      return {
        id: [chain, nft.contract || '', nft.identifier || nft.token_id || 'nft'].join(':'),
        name: nft.name || `NFT #${nft.identifier || 'unknown'}`,
        image: nft.image_url || nft.display_image_url || nft.image || null,
        collection: nft.collection || slug,
        collectionSlug: slug,
        chain: nft.chain || chain,
        contract: nft.contract || null,
        tokenId: nft.identifier || nft.token_id || null,
        price: parsedPrice,
        currency: current?.currency || rawPrice?.currency || null,
        marketplace: 'OpenSea',
        marketplaceUrl: nft.opensea_url || `https://opensea.io/collection/${encodeURIComponent(slug)}`
      };
    });

    return NextResponse.json({ configured: true, slug, items, next: payload.next || null, message: items.length ? null : 'No NFTs were returned for this collection.' });
  } catch {
    return NextResponse.json({ configured: true, items: [], message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
  }
}
