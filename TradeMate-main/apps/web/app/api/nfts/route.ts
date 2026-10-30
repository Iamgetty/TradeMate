import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const COLLECTION_SLUGS: Record<string, string> = {
  'azuki': 'azuki',
  'bored ape yacht club': 'boredapeyachtclub',
  'pudgy penguins': 'pudgypenguins',
  'cryptopunks': 'cryptopunks',
  'doodles': 'doodles-official',
  'clone x': 'clonex',
};

function parsePrice(input: any) {
  const current = input?.current || input?.price || input || {};
  const raw = current.value ?? current.amount ?? current.current_value ?? current.quantity ?? null;
  const decimals = Number(current.decimals ?? input?.decimals ?? 0);
  const value = raw !== null && Number.isFinite(Number(raw))
    ? Number(raw) / (10 ** (Number.isFinite(decimals) ? decimals : 0))
    : null;
  return {
    value: value !== null && Number.isFinite(value) ? value : null,
    currency: current.currency || current.symbol || input?.currency || null,
  };
}

function normalizeAsset(asset: any, fallbackCollection: string) {
  const a = asset || {};
  const collection = a.collection || a.collection_slug || fallbackCollection;
  return {
    name: a.name || (a.identifier || a.token_id ? `NFT #${a.identifier || a.token_id}` : 'Collection offer'),
    image: a.image_url || a.display_image_url || a.image || null,
    collection: typeof collection === 'string' ? collection : (collection?.name || collection?.slug || fallbackCollection),
    contract: a.contract || null,
    tokenId: a.identifier || a.token_id || null,
    marketplaceUrl: a.opensea_url || a.permalink || null,
  };
}

function normalizeSearch(nft: any, fallbackChain: string) {
  const asset = normalizeAsset(nft, 'OpenSea collection');
  const price = parsePrice(nft.price || nft.best_listing_price || nft.best_listing);
  return {
    id: [nft.chain || fallbackChain, asset.contract || '', asset.tokenId || asset.name].join(':'),
    ...asset,
    chain: nft.chain || fallbackChain,
    price: price.value,
    currency: price.currency,
    marketplace: 'OpenSea',
    status: 'DISCOVERED',
    eventType: null,
    time: null,
    maker: null,
    transaction: null,
  };
}

function normalizeOrder(order: any, fallbackCollection: string, kind: 'listing' | 'offer') {
  const asset = normalizeAsset(order.asset, order.criteria?.collection?.slug || fallbackCollection);
  const price = parsePrice(order.price_per_item || order.price);
  const total = parsePrice(order.price);
  return {
    id: [kind, order.chain || '', asset.contract || '', asset.tokenId || '', order.order_hash || order.svm_order?.order_id || ''].join(':'),
    ...asset,
    chain: order.chain || null,
    price: price.value ?? total.value,
    currency: price.currency || total.currency,
    marketplace: 'OpenSea',
    status: order.status || 'ACTIVE',
    eventType: kind,
    time: order.order_created_at ? new Date(Number(order.order_created_at) * 1000).toISOString() : null,
    maker: order.maker || null,
    transaction: null,
    remainingQuantity: order.remaining_quantity ?? null,
  };
}

function normalizeEvent(event: any, fallbackCollection: string) {
  const asset = normalizeAsset(event.asset || event.nft, fallbackCollection);
  const payment = event.payment || {};
  const raw = payment.quantity ?? event.sale_price ?? null;
  const decimals = Number(payment.decimals ?? event.payment?.decimals ?? 0);
  const amount = raw !== null && Number.isFinite(Number(raw))
    ? Number(raw) / (10 ** (Number.isFinite(decimals) ? decimals : 0))
    : null;
  const type = String(event.event_type || 'event').toLowerCase();
  return {
    id: [type, event.chain || '', asset.contract || '', asset.tokenId || '', event.event_timestamp || event.transaction || ''].join(':'),
    ...asset,
    chain: event.chain || null,
    price: amount,
    currency: payment.symbol || null,
    marketplace: 'OpenSea',
    status: type.toUpperCase(),
    eventType: type,
    time: event.event_timestamp ? new Date(Number(event.event_timestamp) * 1000).toISOString() : null,
    maker: event.maker || event.seller || null,
    taker: event.taker || event.buyer || null,
    transaction: event.transaction || null,
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENSEA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      configured: false,
      items: [],
      next: null,
      message: 'NFT data is not connected yet. Add OPENSEA_API_KEY to the TradeMate web service environment.'
    }, { status: 503 });
  }

  const incoming = new URL(request.url);
  const search = incoming.searchParams.get('search')?.trim() || '';
  const chain = incoming.searchParams.get('chain')?.trim() || 'ethereum';
  const view = (incoming.searchParams.get('view') || 'search').toLowerCase();
  const requestedCollection = (incoming.searchParams.get('collection') || '').trim().toLowerCase();
  const collection = COLLECTION_SLUGS[requestedCollection] || requestedCollection;
  const limit = Math.min(Math.max(Number(incoming.searchParams.get('limit') || 24), 1), 48);
  const next = incoming.searchParams.get('next');

  if (!['search', 'discover', 'listings', 'offers', 'sales', 'events'].includes(view)) {
    return NextResponse.json({ configured: true, items: [], message: 'Unsupported NFT data view.' }, { status: 400 });
  }

  if (view === 'search' || view === 'discover') {
    if (!search) {
      return NextResponse.json({
        configured: true, items: [], next: null,
        message: 'Search for an NFT or collection to discover matching OpenSea results.'
      });
    }
    const params = new URLSearchParams({
      query: search.slice(0, 100), chains: chain, asset_types: 'nft', limit: String(limit)
    });
    if (next) params.set('next', next);
    try {
      const response = await fetch(`https://api.opensea.io/api/v2/search?${params.toString()}`, {
        headers: { 'x-api-key': apiKey, accept: 'application/json' }, cache: 'no-store'
      });
      if (!response.ok) {
        return NextResponse.json({
          configured: true, items: [], message: `OpenSea returned status ${response.status}. Check the key, rate limits, and API access.`
        }, { status: response.status === 429 ? 429 : 502 });
      }
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      const items = results.filter((entry: any) => entry.type === 'nft' && entry.nft)
        .map((entry: any) => normalizeSearch(entry.nft, chain));
      return NextResponse.json({ configured: true, items, next: payload.next || null, message: items.length ? null : 'No NFT matches were returned. Try another NFT or collection name.' });
    } catch {
      return NextResponse.json({ configured: true, items: [], next: null, message: 'Could not reach OpenSea. Please try again shortly.' }, { status: 502 });
    }
  }

  if (requestedCollection === 'art' || !collection || !/^[a-z0-9-]{2,80}$/.test(collection)) {
    return NextResponse.json({
      configured: true, items: [], next: null,
      message: 'Choose a named OpenSea collection to load listings, offers, sales, or activity.'
    }, { status: 400 });
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (next) params.set('next', next);
  let endpoint = '';
  if (view === 'listings') endpoint = `/api/v2/listings/collection/${encodeURIComponent(collection)}/all`;
  else if (view === 'offers') endpoint = `/api/v2/offers/collection/${encodeURIComponent(collection)}/all`;
  else {
    endpoint = `/api/v2/events/collection/${encodeURIComponent(collection)}`;
    if (view === 'sales') params.set('event_type', 'sale');
  }

  try {
    const response = await fetch(`https://api.opensea.io${endpoint}?${params.toString()}`, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' }, cache: 'no-store'
    });
    if (!response.ok) {
      return NextResponse.json({
        configured: true, items: [],
        message: `OpenSea ${view} request returned status ${response.status}. Check collection availability, API access, and rate limits.`
      }, { status: response.status === 429 ? 429 : 502 });
    }
    const payload = await response.json();
    const items = view === 'listings'
      ? (payload.listings || []).map((x: any) => normalizeOrder(x, collection, 'listing'))
      : view === 'offers'
        ? (payload.offers || []).map((x: any) => normalizeOrder(x, collection, 'offer'))
        : (payload.asset_events || []).map((x: any) => normalizeEvent(x, collection));
    return NextResponse.json({
      configured: true, items, next: payload.next || null,
      message: items.length ? null : `No live ${view} were returned for ${collection}.`
    });
  } catch {
    return NextResponse.json({ configured: true, items: [], next: null, message: `Could not load OpenSea ${view}. Please try again shortly.` }, { status: 502 });
  }
}
