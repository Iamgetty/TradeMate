import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { isIP } from 'node:net';

type Level = { p: string; q: string };
type Trade = { id: string; venue: string; market: string; price: string; quantity: string; time: number; side: 'buy' | 'sell' };
type Feed = {
  venue: string; market: string; status: string;
  bids: Map<string, string>; asks: Map<string, string>;
  bookAt: number; tradeAt: number; sequence: number | null; sequenceStatus: 'unsupported' | 'awaiting_snapshot' | 'synchronized' | 'gap'; socket?: WebSocket; reconnect?: NodeJS.Timeout; connectionTimeout?: NodeJS.Timeout; pingInterval?: NodeJS.Timeout; reconnectAttempts?: number;
};
type Session = { client: WebSocket; symbol: string; feeds: Map<string, Feed>; trades: Trade[]; timer: NodeJS.Timeout; closed: boolean; backpressureStrikes: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validSymbol = (value: unknown) => typeof value === 'string' && /^[A-Z0-9]{5,24}$/.test(value);
const keyOf = (venue: string, market: string) => venue + ':' + market;
const putLevels = (target: Map<string, string>, rows: unknown) => {
  if (!Array.isArray(rows)) return;
  for (const row of rows as unknown[]) {
    if (!Array.isArray(row)) continue;
    const price = String(row[0]);
    const qty = Number(row[1]);
    if (!(Number(price) > 0) || !Number.isFinite(qty) || qty < 0) continue;
    if (qty === 0) target.delete(price); else target.set(price, String(row[1]));
  }
};
const snapshotLevels = (map: Map<string, string>, count = 50): Level[] =>
  [...map.entries()].map(([p, q]) => ({ p, q }))
    .sort((a, b) => Number(a.p) - Number(b.p))
    .slice(0, count);

const MARKET_FEED_LIMITS = Object.freeze({
  maxConnections: 100,
  maxConnectionsPerIp: 5,
  subscriptionTimeoutMs: 10_000,
  heartbeatIntervalMs: 30_000,
  maxBufferedBytes: 1_048_576,
  maxBackpressureStrikes: 3,
  bookFreshnessMs: 10_000,
});

function marketFeedBookFreshness(bookAt: number, now = Date.now(), maxAgeMs = MARKET_FEED_LIMITS.bookFreshnessMs) {
  const timestamp = Number(bookAt);
  const ageMs = Number.isFinite(timestamp) && timestamp > 0
    ? Math.max(0, now - timestamp)
    : null;
  return { stale: ageMs === null || ageMs > maxAgeMs, ageMs };
}

function marketFeedSequenceAction(
  current: number | null,
  incoming: unknown,
  previous: unknown,
  mode: 'previous' | 'incremental',
): 'apply' | 'ignore' | 'resync' {
  const next = typeof incoming === 'number' ? incoming : Number.NaN;
  if (!Number.isSafeInteger(next) || next < 0 || current === null) return 'resync';
  if (next <= current) return 'ignore';
  if (mode === 'previous') return Number(previous) === current ? 'apply' : 'resync';
  return next === current + 1 ? 'apply' : 'resync';
}

const DEFAULT_MARKET_FEED_ORIGINS = ['https://trademate-web.onrender.com', 'http://localhost:3000'];

function isAllowedMarketFeedOrigin(origin: string | undefined, configuredOrigins = process.env.WEB_ORIGIN || ''): boolean {
  if (!origin) return true;
  let normalized: string;
  try { normalized = new URL(origin).origin; } catch { return false; }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) return false;
  const configured = configuredOrigins.split(',').map((value) => {
    try { return new URL(value.trim()).origin; } catch { return ''; }
  }).filter(Boolean);
  const allowed = new Set([...DEFAULT_MARKET_FEED_ORIGINS, ...configured]);
  return allowed.has(normalized);
}

function marketFeedClientIp(request: IncomingMessage): string {
  // main.ts configures exactly one trusted proxy hop. The edge proxy appends
  // the connecting client address as the right-most X-Forwarded-For value.
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedValues = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded || '').split(',').map((value) => value.trim()).filter(Boolean);
  const candidate = forwardedValues.length ? forwardedValues[forwardedValues.length - 1] : undefined;
  if (candidate && isIP(candidate)) return candidate;
  return request.socket.remoteAddress || 'unknown';
}

type MarketFeedOptions = {
  createUpstreamSocket?: (url: string, options: { handshakeTimeout: number }) => WebSocket;
};

function attachMarketFeed(server: Server, options: MarketFeedOptions = {}) {
  const createUpstreamSocket = options.createUpstreamSocket ?? ((url, socketOptions) => new WebSocket(url, socketOptions));
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const sessions = new Set<Session>();
  const connectionsByIp = new Map<string, number>();
  const aliveClients = new WeakMap<WebSocket, boolean>();

  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (aliveClients.get(client) === false) { client.terminate(); continue; }
      aliveClients.set(client, false);
      if (client.readyState === WebSocket.OPEN) client.ping();
    }
  }, MARKET_FEED_LIMITS.heartbeatIntervalMs);
  heartbeat.unref?.();

  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try { pathname = new URL(request.url || '/', 'http://localhost').pathname; } catch { return; }
    if (pathname !== '/api/market-feed') return;
    if (!isAllowedMarketFeedOrigin(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const ip = marketFeedClientIp(request);
    if (wss.clients.size >= MARKET_FEED_LIMITS.maxConnections || (connectionsByIp.get(ip) || 0) >= MARKET_FEED_LIMITS.maxConnectionsPerIp) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
  });

  const send = (session: Session, payload: unknown) => {
    if (session.client.readyState !== WebSocket.OPEN) return;
    if (session.client.bufferedAmount > MARKET_FEED_LIMITS.maxBufferedBytes) {
      session.backpressureStrikes += 1;
      if (session.backpressureStrikes >= MARKET_FEED_LIMITS.maxBackpressureStrikes) session.client.close(1013, 'Market feed client is too slow.');
      return;
    }
    session.backpressureStrikes = 0;
    session.client.send(JSON.stringify(payload));
  };
  const stopFeed = (feed: Feed) => {
    if (feed.reconnect) clearTimeout(feed.reconnect);
    if (feed.connectionTimeout) clearTimeout(feed.connectionTimeout);
    if (feed.pingInterval) clearInterval(feed.pingInterval);
    if (feed.socket) {
      feed.socket.removeAllListeners();
      try { feed.socket.close(); } catch { /* already closed */ }
    }
  };
  const stopSession = (session: Session) => {
    if (session.closed) return;
    session.closed = true;
    clearInterval(session.timer);
    session.feeds.forEach(stopFeed);
    session.feeds.clear();
    sessions.delete(session);
  };
  const addTrade = (session: Session, feed: Feed, id: unknown, price: unknown, quantity: unknown, time: unknown, side: unknown) => {
    const p = String(price ?? ''), q = String(quantity ?? '');
    if (!(Number(p) > 0 && Number(q) > 0)) return;
    const tradeId = String(id ?? (String(time) + ':' + p + ':' + q));
    if (session.trades.some((trade) => trade.id === keyOf(feed.venue, feed.market) + ':' + tradeId)) return;
    session.trades.unshift({
      id: keyOf(feed.venue, feed.market) + ':' + tradeId,
      venue: feed.venue, market: feed.market, price: p, quantity: q,
      time: Number(time) > 0 ? Number(time) : Date.now(),
      side: side === 'sell' ? 'sell' : 'buy',
    });
    session.trades = session.trades.slice(0, 100);
    feed.tradeAt = Date.now();
  };
  const connect = (session: Session, feed: Feed, url: string, onMessage: (data: Record<string, unknown>) => void, onOpen?: (ws: WebSocket) => void) => {
    if (session.closed) return;
    feed.status = 'connecting';
    let ws: WebSocket;
    try { ws = createUpstreamSocket(url, { handshakeTimeout: 10_000 }); } catch {
      feed.status = 'unavailable';
      return;
    }
    feed.socket = ws;
    const timeout = setTimeout(() => {
      if (!feed.bookAt && !feed.tradeAt && feed.status === 'connecting') feed.status = 'stale';
    }, 12000);
    feed.connectionTimeout = timeout;
    ws.on('open', () => { clearTimeout(timeout); feed.connectionTimeout = undefined; feed.reconnectAttempts = 0; feed.status = 'connected'; onOpen?.(ws); });
    ws.on('message', (raw) => {
      try {
        const message: unknown = JSON.parse(raw.toString());
        if (isRecord(message)) onMessage(message);
      } catch { /* ignore malformed upstream frames */ }
    });
    ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (feed.connectionTimeout === timeout) feed.connectionTimeout = undefined;
      if (session.closed || feed.socket !== ws) return;
      feed.status = 'reconnecting';
      feed.bids.clear();
      feed.asks.clear();
      feed.bookAt = 0;
      feed.sequence = null;
      if (feed.sequenceStatus !== 'unsupported' && feed.sequenceStatus !== 'gap') feed.sequenceStatus = 'awaiting_snapshot';
      const attempts = feed.reconnectAttempts || 0;
      const backoffMs = Math.min(30_000, 1_000 * (2 ** Math.min(attempts, 5)));
      const jitterMs = Math.floor(Math.random() * 500);
      feed.reconnectAttempts = attempts + 1;
      feed.reconnect = setTimeout(() => {
        if (!session.closed && feed.socket === ws) connect(session, feed, url, onMessage, onOpen);
      }, backoffMs + jitterMs);
    });
  };
  const addFeed = (session: Session, venue: string, market: string) => {
    const feed: Feed = { venue, market, status: 'connecting', bids: new Map(), asks: new Map(), bookAt: 0, tradeAt: 0, sequence: null, sequenceStatus: venue === 'binance' ? 'unsupported' : 'awaiting_snapshot' };
    session.feeds.set(keyOf(venue, market), feed);
    return feed;
  };
  const startFeeds = (session: Session) => {
    const symbol = session.symbol.toLowerCase();
    const spot = addFeed(session, 'binance', 'spot');
    connect(session, spot,
      'wss://stream.binance.com:443/stream?streams=' + symbol + '@depth20@100ms/' + symbol + '@trade',
      (message) => {
        const d = isRecord(message.data) ? message.data : message;
        if (d.e === 'depthUpdate' || (d.bids && d.asks)) {
          spot.bids.clear(); spot.asks.clear();
          putLevels(spot.bids, d.b || d.bids); putLevels(spot.asks, d.a || d.asks);
          spot.bookAt = Date.now();
        } else if (d.e === 'trade') {
          addTrade(session, spot, d.t, d.p, d.q, d.T, d.m ? 'sell' : 'buy');
        }
        if (spot.bookAt || spot.tradeAt) spot.status = 'live';
      });

    const futures = addFeed(session, 'binance', 'futures');
    connect(session, futures,
      'wss://fstream.binance.com/market/stream?streams=' + symbol + '@depth20@100ms/' + symbol + '@aggTrade',
      (message) => {
        const d = isRecord(message.data) ? message.data : message;
        if (d.e === 'depthUpdate' || (d.bids && d.asks)) {
          futures.bids.clear(); futures.asks.clear();
          putLevels(futures.bids, d.b || d.bids); putLevels(futures.asks, d.a || d.asks);
          futures.bookAt = Date.now();
        } else if (d.e === 'aggTrade') {
          addTrade(session, futures, d.a, d.p, d.q, d.T, d.m ? 'sell' : 'buy');
        }
        if (futures.bookAt || futures.tradeAt) futures.status = 'live';
      });

    for (const market of ['spot', 'linear']) {
      const feed = addFeed(session, 'bybit', market);
      const endpoint = market === 'spot' ? 'spot' : 'linear';
      connect(session, feed, 'wss://stream.bybit.com/v5/public/' + endpoint, (d) => {
        if (typeof d.topic === 'string' && d.topic.startsWith('orderbook.')) {
          const data = isRecord(d.data) ? d.data : {};
          const incomingSequence = Number(data.u);
          if (d.type === 'snapshot') {
            if (!Number.isSafeInteger(incomingSequence) || incomingSequence < 0) {
              feed.sequenceStatus = 'gap';
              feed.bids.clear(); feed.asks.clear(); feed.bookAt = 0;
              feed.socket?.close();
              return;
            }
            feed.bids.clear(); feed.asks.clear();
            putLevels(feed.bids, data.b); putLevels(feed.asks, data.a);
            feed.sequence = incomingSequence;
            feed.sequenceStatus = 'synchronized';
            feed.bookAt = Date.now();
          } else if (d.type === 'delta') {
            // Bybit's standard orderbook stream documents consecutive `u` update IDs;
            // `pu` is not part of this message contract. `seq` is cross-level metadata,
            // not a consecutive per-book update counter.
            const action = incomingSequence === 1
              ? 'resync'
              : marketFeedSequenceAction(feed.sequence, data.u, undefined, 'incremental');
            if (action === 'ignore') return;
            if (action === 'resync') {
              feed.sequenceStatus = 'gap';
              feed.bids.clear(); feed.asks.clear(); feed.bookAt = 0;
              feed.socket?.close();
              return;
            }
            putLevels(feed.bids, data.b); putLevels(feed.asks, data.a);
            feed.sequence = incomingSequence;
            feed.bookAt = Date.now();
          }
        } else if (typeof d.topic === 'string' && d.topic.startsWith('publicTrade.')) {
          const trades = Array.isArray(d.data) ? d.data as unknown[] : [];
          for (const trade of trades) {
            if (!isRecord(trade)) continue;
            addTrade(session, feed, trade.i, trade.p, trade.v, trade.T, trade.S === 'Sell' ? 'sell' : 'buy');
          }
        }
        if (feed.bookAt || feed.tradeAt) feed.status = 'live';
      }, (ws) => {
        ws.send(JSON.stringify({ op: 'subscribe', args: ['orderbook.50.' + session.symbol, 'publicTrade.' + session.symbol] }));
        feed.pingInterval = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' })); }, 20000);
      });
    }

    // Coinbase products are USD-quoted. Do not fabricate a product for USDT/NGN or other quotes.
    if (session.symbol.endsWith('USD')) {
      const product = session.symbol.slice(0, -3) + '-USD';
      const feed = addFeed(session, 'coinbase', 'spot');
      connect(session, feed, 'wss://ws-feed.exchange.coinbase.com', (d) => {
        if (d.type === 'snapshot' && d.product_id === product) {
          // Coinbase Exchange classic level2 snapshots contain the full book but
          // do not define a sequence_num field in this feed contract.
          feed.bids.clear(); feed.asks.clear();
          putLevels(feed.bids, d.bids); putLevels(feed.asks, d.asks);
          feed.sequence = null;
          feed.sequenceStatus = 'unsupported';
          feed.bookAt = Date.now();
        } else if (d.type === 'l2update' && d.product_id === product) {
          // The classic Exchange level2 channel guarantees delivery. Do not apply
          // Advanced Trade's sequence_num schema to this different endpoint.
          const changes = Array.isArray(d.changes) ? d.changes as unknown[] : [];
          for (const change of changes) {
            if (!Array.isArray(change) || change.length < 3) continue;
            const [side, price, qty] = change as unknown[];
            putLevels(side === 'buy' ? feed.bids : feed.asks, [[price, qty]]);
          }
          feed.bookAt = Date.now();
        } else if (d.type === 'match' && d.product_id === product) {
          addTrade(session, feed, d.trade_id, d.price, d.size, typeof d.time === 'string' ? Date.parse(d.time) : Date.now(), d.side);
        }
        if (feed.bookAt || feed.tradeAt) feed.status = 'live';
      }, (ws) => ws.send(JSON.stringify({ type: 'subscribe', product_ids: [product], channels: ['level2', 'matches'] })));
    }
  };

  wss.on('connection', (client, request) => {
    const ip = marketFeedClientIp(request as IncomingMessage);
    aliveClients.set(client, true);
    connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);
    let session: Session | null = null;
    let released = false;
    const subscriptionTimeout = setTimeout(() => {
      if (!session && client.readyState === WebSocket.OPEN) client.close(1008, 'Subscribe to a market feed to continue.');
    }, MARKET_FEED_LIMITS.subscriptionTimeoutMs);
    const releaseConnection = () => {
      if (released) return;
      released = true;
      clearTimeout(subscriptionTimeout);
      if (session) stopSession(session);
      const count = (connectionsByIp.get(ip) || 1) - 1;
      if (count <= 0) connectionsByIp.delete(ip); else connectionsByIp.set(ip, count);
    };
    client.on('pong', () => aliveClients.set(client, true));
    client.on('message', (raw) => {
      let message: unknown;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (!isRecord(message) || message.type !== 'subscribe' || !validSymbol(message.symbol)) {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'error', message: 'Choose a supported market symbol.' }));
        return;
      }
      const requestedSymbol = String(message.symbol).toUpperCase();
      if (session) {
        if (session.symbol !== requestedSymbol && client.readyState === WebSocket.OPEN) client.close(1008, 'One market symbol is allowed per connection.');
        return;
      }
      clearTimeout(subscriptionTimeout);
      session = {
        client, symbol: requestedSymbol, feeds: new Map(), trades: [],
        timer: setInterval(() => undefined, 60000), closed: false, backpressureStrikes: 0,
      };
      sessions.add(session);
      startFeeds(session);
      clearInterval(session.timer);
      session.timer = setInterval(() => {
        const snapshotAt = Date.now();
        const books = [...session!.feeds.values()].map((feed) => {
          const freshness = marketFeedBookFreshness(feed.bookAt, snapshotAt);
          const status = freshness.stale && (feed.status === 'live' || feed.status === 'connected')
            ? 'stale'
            : feed.status;
          return {
            venue: feed.venue, market: feed.market, status,
            stale: freshness.stale || feed.sequenceStatus === 'gap' || feed.sequenceStatus === 'awaiting_snapshot', bookAgeMs: freshness.ageMs, sequenceStatus: feed.sequenceStatus, sequence: feed.sequence,
            bids: snapshotLevels(feed.bids).sort((a, b) => Number(b.p) - Number(a.p)).slice(0, 20),
            asks: snapshotLevels(feed.asks).slice(0, 20),
            bookAt: feed.bookAt, tradeAt: feed.tradeAt,
          };
        });
        send(session!, {
          type: 'snapshot', symbol: session!.symbol, ts: snapshotAt, books,
          trades: session!.trades.slice(0, 80),
          feeds: books.map(({ venue, market, status, stale, bookAgeMs, sequenceStatus, sequence, bookAt, tradeAt }) => ({
            venue, market, status, stale, bookAgeMs, sequenceStatus, sequence, bookAt, tradeAt,
          })),
        });
      }, 1000);
    });
    client.on('close', releaseConnection);
    client.on('error', releaseConnection);
  });

  return () => {
    clearInterval(heartbeat);
    for (const session of sessions) stopSession(session);
    for (const client of wss.clients) client.close(1001, 'Market feed server is shutting down.');
    wss.close();
  };
}

export { attachMarketFeed, isAllowedMarketFeedOrigin, marketFeedClientIp, marketFeedBookFreshness, marketFeedSequenceAction, MARKET_FEED_LIMITS };
