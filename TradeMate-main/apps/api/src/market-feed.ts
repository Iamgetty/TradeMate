import WebSocket, { WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { isIP } from 'node:net';

type Level = { p: string; q: string };
type Trade = { id: string; venue: string; market: string; price: string; quantity: string; time: number; side: 'buy' | 'sell' };
type Feed = {
  venue: string; market: string; status: string;
  bids: Map<string, string>; asks: Map<string, string>;
  bookAt: number; tradeAt: number; socket?: WebSocket; reconnect?: NodeJS.Timeout; connectionTimeout?: NodeJS.Timeout; pingInterval?: NodeJS.Timeout; reconnectAttempts?: number;
};
type Session = { client: WebSocket; symbol: string; feeds: Map<string, Feed>; trades: Trade[]; timer: NodeJS.Timeout; closed: boolean; backpressureStrikes: number };

const validSymbol = (value: unknown) => typeof value === 'string' && /^[A-Z0-9]{5,24}$/.test(value);
const keyOf = (venue: string, market: string) => venue + ':' + market;
const levels = (rows: unknown): Level[] => Array.isArray(rows) ? rows
  .filter((row: any) => Array.isArray(row) && Number(row[0]) > 0 && Number(row[1]) > 0)
  .map((row: any) => ({ p: String(row[0]), q: String(row[1]) })) : [];
const putLevels = (target: Map<string, string>, rows: unknown) => {
  if (!Array.isArray(rows)) return;
  for (const row of rows as any[]) {
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
});

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

function attachMarketFeed(server: Server) {
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
  const connect = (session: Session, feed: Feed, url: string, onMessage: (data: any) => void, onOpen?: (ws: WebSocket) => void) => {
    if (session.closed) return;
    feed.status = 'connecting';
    let ws: WebSocket;
    try { ws = new WebSocket(url, { handshakeTimeout: 10_000 }); } catch {
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
      try { onMessage(JSON.parse(raw.toString())); } catch { /* ignore malformed upstream frames */ }
    });
    ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (feed.connectionTimeout === timeout) feed.connectionTimeout = undefined;
      if (session.closed || feed.socket !== ws) return;
      feed.status = 'reconnecting';
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
    const feed: Feed = { venue, market, status: 'connecting', bids: new Map(), asks: new Map(), bookAt: 0, tradeAt: 0 };
    session.feeds.set(keyOf(venue, market), feed);
    return feed;
  };
  const startFeeds = (session: Session) => {
    const symbol = session.symbol.toLowerCase();
    const spot = addFeed(session, 'binance', 'spot');
    connect(session, spot,
      'wss://stream.binance.com:443/stream?streams=' + symbol + '@depth20@100ms/' + symbol + '@trade',
      (message) => {
        const d = message.data || message;
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
        const d = message.data || message;
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
        if (d.topic?.startsWith('orderbook.')) {
          const targetBids = feed.bids, targetAsks = feed.asks;
          if (d.type === 'snapshot') { targetBids.clear(); targetAsks.clear(); }
          putLevels(targetBids, d.data?.b);
          putLevels(targetAsks, d.data?.a);
          feed.bookAt = Date.now();
        } else if (d.topic?.startsWith('publicTrade.')) {
          for (const t of d.data || []) addTrade(session, feed, t.i, t.p, t.v, t.T, t.S === 'Sell' ? 'sell' : 'buy');
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
          feed.bids.clear(); feed.asks.clear();
          putLevels(feed.bids, d.bids); putLevels(feed.asks, d.asks);
          feed.bookAt = Date.now();
        } else if (d.type === 'l2update' && d.product_id === product) {
          for (const [side, price, qty] of d.changes || []) putLevels(side === 'buy' ? feed.bids : feed.asks, [[price, qty]]);
          feed.bookAt = Date.now();
        } else if (d.type === 'match' && d.product_id === product) {
          addTrade(session, feed, d.trade_id, d.price, d.size, d.time ? Date.parse(d.time) : Date.now(), d.side);
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
      let message: any;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type !== 'subscribe' || !validSymbol(message.symbol)) {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'error', message: 'Choose a supported market symbol.' }));
        return;
      }
      const requestedSymbol = message.symbol.toUpperCase();
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
        const books = [...session!.feeds.values()].map((feed) => ({
          venue: feed.venue, market: feed.market, status: feed.status,
          bids: snapshotLevels(feed.bids).sort((a, b) => Number(b.p) - Number(a.p)).slice(0, 20),
          asks: snapshotLevels(feed.asks).slice(0, 20),
          bookAt: feed.bookAt, tradeAt: feed.tradeAt,
        }));
        send(session!, {
          type: 'snapshot', symbol: session!.symbol, ts: Date.now(), books,
          trades: session!.trades.slice(0, 80),
          feeds: books.map(({ venue, market, status, bookAt, tradeAt }) => ({ venue, market, status, bookAt, tradeAt })),
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

export { attachMarketFeed, isAllowedMarketFeedOrigin, marketFeedClientIp, MARKET_FEED_LIMITS };
