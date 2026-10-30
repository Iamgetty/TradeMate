// Multi-exchange live feed (data only, no UI).
// Binance (spot + futures), Bybit (spot + linear futures), Coinbase (spot).
// Keeps live order-book depth and trades per exchange, and pushes ONE JSON
// snapshot per second to every connected client (your app).
//
// Run: npm install && npm start
// Health check: GET /health

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const PUSH_MS = 1000;   // update rate to your app
const STALE_MS = 5000;  // a book is flagged stale after this much silence
const DEPTH = 20;       // price levels per side sent to clients

// ---- Edit your symbols here ------------------------------------------------
const SPOT = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'USDC', 'ADA', 'TRX', 'TON', 'AVAX', 'DOT',
  'LINK', 'POL', 'LTC', 'BCH', 'XLM', 'ATOM', 'NEAR', 'UNI', 'SHIB', 'DAI', 'ETC',
].map((c) => `${c}USDT`);
const PERPS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK'].map((c) => `${c}USDT`);
// Coinbase only lists some of these (no BNB, TRX, TON), so its list is shorter
const CB = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'DOT', 'LINK', 'LTC', 'BCH', 'XLM',
  'ATOM', 'NEAR', 'UNI', 'SHIB', 'ETC'].map((c) => `${c}-USD`);

const CFG = {
  binanceSpot:    SPOT,
  binanceFutures: PERPS,
  bybitSpot:      SPOT,
  bybitLinear:    PERPS,
  coinbase:       CB,
};

// ---- Helpers ----------------------------------------------------------------
const KNOWN_QUOTES = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR', 'BTC', 'ETH'];
function splitSymbol(sym) {
  if (sym.includes('-')) { const [base, quote] = sym.split('-'); return { base, quote }; }
  const q = KNOWN_QUOTES.find((x) => sym.endsWith(x) && sym.length > x.length);
  return q ? { base: sym.slice(0, -q.length), quote: q } : { base: sym, quote: '' };
}

// ---- State ------------------------------------------------------------------
const books = new Map();        // "exchange|market|symbol" -> { bids: Map, asks: Map, ... }
const feedStatus = new Map();   // connection name -> recently receiving messages
const feedLastMessage = new Map();
const FEED_IDLE_MS = 30000; // a connected but silent socket is not counted as live
let pendingTrades = [];

function getBook(exchange, market, symbol) {
  const k = `${exchange}|${market}|${symbol}`;
  let b = books.get(k);
  if (!b) {
    b = { exchange, market, symbol, ...splitSymbol(symbol), bids: new Map(), asks: new Map(), ts: 0, last: null, synced: false };
    books.set(k, b);
  }
  return b;
}
const touch = (b) => { b.ts = Date.now(); };
function validLevel(price, size) {
  return Number.isFinite(price) && price > 0 && Number.isFinite(size) && size >= 0;
}
function replaceSide(map, levels) {
  map.clear();
  for (const [rawPrice, rawSize] of levels) {
    const price = Number(rawPrice), size = Number(rawSize);
    if (validLevel(price, size) && size > 0) map.set(price, size);
  }
}
function applySide(map, levels) {
  for (const [rawPrice, rawSize] of levels) {
    const price = Number(rawPrice), size = Number(rawSize);
    if (!validLevel(price, size)) continue;
    if (size === 0) map.delete(price);
    else map.set(price, size);
  }
}
function addTrade(exchange, market, symbol, t) {
  const price = Number(t.price), qty = Number(t.qty), ts = Number(t.ts);
  const side = String(t.side || '').toLowerCase();
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(qty) || qty <= 0 ||
      !Number.isFinite(ts) || (side !== 'buy' && side !== 'sell')) return;
  const trade = { ...t, price, qty, ts, side };
  pendingTrades.push({ exchange, market, symbol, ...splitSymbol(symbol), ...trade });
  if (pendingTrades.length > 500) pendingTrades.shift();
  getBook(exchange, market, symbol).last = price;
}

// ---- Resilient WebSocket helper (auto-reconnect with backoff) --------------
function connect(name, url, onOpen, onMessage, opts = {}) {
  feedStatus.set(name, false);
  let attempt = 0;
  const start = () => {
    const ws = new WebSocket(url);
    let pingTimer;
    ws.on('open', () => {
      attempt = 0;
      feedStatus.set(name, false); // count as live only after messages arrive
      console.log(`[${name}] connected; awaiting market data`);
      onOpen(ws);
      if (opts.ping) pingTimer = setInterval(() => ws.readyState === 1 && ws.send(opts.ping), 20000);
    });
    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw);
        onMessage(message);
        if (opts.isMarketData && opts.isMarketData(message)) {
          feedLastMessage.set(name, Date.now());
          feedStatus.set(name, true);
        }
      } catch (e) { console.error(`[${name}] parse error:`, e.message); }
    });
    ws.on('error', (e) => console.error(`[${name}] error:`, e.message));
    ws.on('close', () => {
      clearInterval(pingTimer);
      feedStatus.set(name, false);
      const delay = Math.min(30000, 1000 * 2 ** attempt++);
      console.log(`[${name}] closed, reconnecting in ${delay} ms`);
      setTimeout(start, delay);
    });
  };
  start();
}

// ---- Binance: partial depth snapshots (20 levels, 100 ms) + aggTrade -------
function binance(market, host, symbols) {
  if (!symbols.length) return;
  const streams = symbols
    .flatMap((s) => [`${s.toLowerCase()}@depth20@100ms`, `${s.toLowerCase()}@aggTrade`])
    .join('/');
  connect(`binance-${market}`, `${host}/stream?streams=${streams}`, () => {}, (msg) => {
    const d = msg.data;
    if (!d || !msg.stream) return;
    const [sym, type] = msg.stream.split('@');
    const symbol = sym.toUpperCase();
    if (type.startsWith('depth')) {
      const b = getBook('binance', market, symbol);
      replaceSide(b.bids, d.bids || d.b || []);   // spot uses bids/asks, futures uses b/a
      replaceSide(b.asks, d.asks || d.a || []);
      b.synced = true; // Binance depth20 messages are complete partial-book snapshots
      touch(b);
    } else if (type === 'aggTrade') {
      addTrade('binance', market, symbol, { id: String(d.a), price: +d.p, qty: +d.q, side: d.m ? 'sell' : 'buy', ts: d.T });
    }
  }, { isMarketData: (msg) => !!(msg && msg.stream && msg.data && (msg.data.e === 'depthUpdate' || msg.data.e === 'aggTrade')) });
}

// ---- Bybit V5: orderbook.50 (snapshot + deltas) + publicTrade --------------
function bybit(market, symbols) {
  if (!symbols.length) return;
  connect(
    `bybit-${market}`,
    `wss://stream.bybit.com/v5/public/${market}`,
    (ws) => {
      const args = symbols.flatMap((s) => [`orderbook.50.${s}`, `publicTrade.${s}`]);
      for (let i = 0; i < args.length; i += 10) {   // Bybit spot allows max 10 topics per request
        ws.send(JSON.stringify({ op: 'subscribe', args: args.slice(i, i + 10) }));
      }
    },
    (msg) => {
      if (!msg.topic) return;
      if (msg.topic.startsWith('orderbook.')) {
        const d = msg.data;
        const b = getBook('bybit', market, d.s);
        if (msg.type === 'snapshot') {
          replaceSide(b.bids, d.b || []);
          replaceSide(b.asks, d.a || []);
          b.synced = true;
        } else {
          // Never expose a partial Bybit book before its initial snapshot.
          if (!b.synced) return;
          applySide(b.bids, d.b || []);
          applySide(b.asks, d.a || []);
        }
        touch(b);
      } else if (msg.topic.startsWith('publicTrade.')) {
        for (const t of msg.data) {
          addTrade('bybit', market, t.s, { id: String(t.i), price: +t.p, qty: +t.v, side: t.S.toLowerCase(), ts: t.T });
        }
      }
    },
    {
      ping: JSON.stringify({ op: 'ping' }),
      isMarketData: (msg) => !!(msg && typeof msg.topic === 'string' && (msg.topic.startsWith('orderbook.') || msg.topic.startsWith('publicTrade.'))),
    }
  );
}

// ---- Coinbase Advanced Trade: level2 (snapshot + updates) + market_trades --
function coinbase(products) {
  if (!products.length) return;
  connect(
    'coinbase',
    'wss://advanced-trade-ws.coinbase.com',
    (ws) => {
      for (const channel of ['level2', 'market_trades']) {
        ws.send(JSON.stringify({ type: 'subscribe', product_ids: products, channel }));
      }
    },
    (msg) => {
      if (msg.channel === 'l2_data') {
        for (const e of msg.events || []) {
          const b = getBook('coinbase', 'spot', e.product_id);
          if (e.type === 'snapshot') {
            b.bids.clear();
            b.asks.clear();
            b.synced = true;
          } else if (!b.synced) {
            // Ignore level2 updates until Coinbase has supplied a full snapshot.
            continue;
          }
          for (const u of e.updates || []) {
            if (u.side !== 'bid' && u.side !== 'offer') continue;
            const map = u.side === 'bid' ? b.bids : b.asks;
            const p = Number(u.price_level), q = Number(u.new_quantity);
            if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(q) || q < 0) continue;
            if (q === 0) map.delete(p); else map.set(p, q);
          }
          touch(b);
        }
      } else if (msg.channel === 'market_trades') {
        for (const e of msg.events || []) for (const t of e.trades || []) {
          addTrade('coinbase', 'spot', t.product_id, {
            id: String(t.trade_id), price: +t.price, qty: +t.size, side: String(t.side).toLowerCase(), ts: Date.parse(t.time),
          });
        }
      }
    },
    { isMarketData: (msg) => !!(msg && (msg.channel === 'l2_data' || msg.channel === 'market_trades')) }
  );
}

binance('spot', 'wss://stream.binance.com:9443', CFG.binanceSpot);
binance('futures', 'wss://fstream.binance.com', CFG.binanceFutures);
bybit('spot', CFG.bybitSpot);
bybit('linear', CFG.bybitLinear);
coinbase(CFG.coinbase);

// ---- Server for your app ----------------------------------------------------
const feedsInfo = () => {
  const now = Date.now();
  const status = Object.fromEntries([...feedStatus].map(([name, connected]) => {
    const active = connected && now - (feedLastMessage.get(name) || 0) <= FEED_IDLE_MS;
    return [name, active];
  }));
  return { live: Object.values(status).filter(Boolean).length, total: feedStatus.size, status };
};

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, feeds: feedsInfo(), books: books.size }));
});
const wss = new WebSocket.Server({ server });

// Each client says which coin it is viewing: {"op":"watch","base":"BTC"}.
// That coin gets full depth and trades. Every other coin gets only best bid, ask
// and last price, which keeps mobile data use low while the market list stays live.
wss.on('connection', (ws) => {
  ws.watch = null;
  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.op === 'watch' && /^[A-Za-z0-9]{1,15}$/.test(String(m.base))) ws.watch = String(m.base).toUpperCase();
    } catch (e) { /* ignore malformed messages */ }
  });
});

// Keep only the best N levels while scanning; avoid sorting an entire exchange book.
function top(map, desc, limit = DEPTH) {
  const out = [];
  for (const entry of map) {
    let i = 0;
    while (i < out.length && (desc ? out[i][0] >= entry[0] : out[i][0] <= entry[0])) i++;
    if (i >= limit) continue;
    out.splice(i, 0, entry);
    if (out.length > limit) out.pop();
  }
  return out;
}

setInterval(() => {
  const now = Date.now();
  const watchedBases = new Set([...wss.clients]
    .filter((client) => client.readyState === WebSocket.OPEN && client.watch)
    .map((client) => client.watch));
  const list = [...books.values()].filter((b) => b.ts).map((b) => {
    const depth = watchedBases.has(b.base) ? DEPTH : 1;
    const bids = top(b.bids, true, depth), asks = top(b.asks, false, depth);
    return {
      exchange: b.exchange, market: b.market, symbol: b.symbol, base: b.base, quote: b.quote,
      bid: bids.length ? bids[0][0] : null, ask: asks.length ? asks[0][0] : null,
      last: b.last, stale: now - b.ts > STALE_MS, bids, asks,
    };
  });
  const trades = pendingTrades;
  pendingTrades = [];
  const feeds = feedsInfo();
  const cache = new Map();   // one JSON string per watched coin, shared by all clients on it
  for (const c of wss.clients) {
    if (c.readyState !== WebSocket.OPEN) continue;
    const key = c.watch || '';
    if (!cache.has(key)) {
      cache.set(key, JSON.stringify({
        ts: now, feeds,
        books: list.map(({ bids, asks, ...slim }) => (key && slim.base === key ? { ...slim, bids, asks } : slim)),
        trades: key ? trades.filter((t) => t.base === key) : [],
      }));
    }
    c.send(cache.get(key));
  }
}, PUSH_MS);

server.listen(PORT, () => console.log(`Feed server on port ${PORT}`));
