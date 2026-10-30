import WebSocket, { WebSocketServer } from 'ws';
import type { Server } from 'node:http';

type Level = { p: string; q: string };
type Trade = { id: string; venue: string; market: string; price: string; quantity: string; time: number; side: 'buy' | 'sell' };
type Feed = {
  venue: string; market: string; status: string;
  bids: Map<string, string>; asks: Map<string, string>;
  bookAt: number; tradeAt: number; socket?: WebSocket; reconnect?: NodeJS.Timeout;
};
type Session = { client: WebSocket; symbol: string; feeds: Map<string, Feed>; trades: Trade[]; timer: NodeJS.Timeout; closed: boolean };

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

function attachMarketFeed(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const sessions = new Set<Session>();

  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    try { pathname = new URL(request.url || '/', 'http://localhost').pathname; } catch { return; }
    if (pathname !== '/api/market-feed') return;
    wss.handleUpgrade(request, socket, head, (client) => wss.emit('connection', client, request));
  });

  const send = (session: Session, payload: unknown) => {
    if (session.client.readyState === WebSocket.OPEN) session.client.send(JSON.stringify(payload));
  };
  const stopFeed = (feed: Feed) => {
    if (feed.reconnect) clearTimeout(feed.reconnect);
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
    try { ws = new WebSocket(url); } catch {
      feed.status = 'unavailable';
      return;
    }
    feed.socket = ws;
    const timeout = setTimeout(() => {
      if (!feed.bookAt && !feed.tradeAt && feed.status === 'connecting') feed.status = 'stale';
    }, 12000);
    ws.on('open', () => { feed.status = 'connected'; onOpen?.(ws); });
    ws.on('message', (raw) => {
      try { onMessage(JSON.parse(raw.toString())); } catch { /* ignore malformed upstream frames */ }
    });
    ws.on('error', () => { try { ws.close(); } catch { /* noop */ } });
    ws.on('close', () => {
      clearTimeout(timeout);
      if (session.closed || feed.socket !== ws) return;
      feed.status = 'reconnecting';
      feed.reconnect = setTimeout(() => {
        if (!session.closed && feed.socket === ws) connect(session, feed, url, onMessage, onOpen);
      }, 2500);
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
        const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ op: 'ping' })); }, 20000);
        ws.once('close', () => clearInterval(ping));
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

  wss.on('connection', (client) => {
    let session: Session | null = null;
    client.on('message', (raw) => {
      let message: any;
      try { message = JSON.parse(raw.toString()); } catch { return; }
      if (message.type !== 'subscribe' || !validSymbol(message.symbol)) {
        if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify({ type: 'error', message: 'Choose a supported market symbol.' }));
        return;
      }
      if (session) stopSession(session);
      session = {
        client, symbol: message.symbol.toUpperCase(), feeds: new Map(), trades: [],
        timer: setInterval(() => undefined, 60000), closed: false,
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
    client.on('close', () => { if (session) stopSession(session); });
    client.on('error', () => { if (session) stopSession(session); });
  });

  return () => { for (const session of sessions) stopSession(session); wss.close(); };
}

export { attachMarketFeed };
