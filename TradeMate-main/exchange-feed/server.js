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
const feedStatus = new Map();   // connection name -> true/false
let pendingTrades = [];

function getBook(exchange, market, symbol) {
  const k = `${exchange}|${market}|${symbol}`;
  let b = books.get(k);
  if (!b) {
    b = { exchange, market, symbol, ...splitSymbol(symbol), bids: new Map(), asks: new Map(), ts: 0, last: null };
    books.set(k, b);
  }
  return b;
}
const touch = (b) => { b.ts = Date.now(); };
function replaceSide(map, levels) {
  map.clear();
  for (const [p, s] of levels) if (+s > 0) map.set(+p, +s);
}
function applySide(map, levels) {
  for (const [p, s] of levels) { if (+s === 0) map.delete(+p); else map.set(+p, +s); }
}
function addTrade(exchange, market, symbol, t) {
  pendingTrades.push({ exchange, market, symbol, ...splitSymbol(symbol), ...t });
  if (pendingTrades.length > 500) pendingTrades.shift();
  getBook(exchange, market, symbol).last = t.price;
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
      feedStatus.set(name, true);
      console.log(`[${name}] connected`);
      onOpen(ws);
      if (opts.ping) pingTimer = setInterval(() => ws.readyState === 1 && ws.send(opts.ping), 20000);
    });
    ws.on('message', (raw) => {
      try { onMessage(JSON.parse(raw)); }
      catch (e) { console.error(`[${name}] parse error:`, e.message); }
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
      touch(b);
    } else if (type === 'aggTrade') {
      addTrade('binance', market, symbol, { id: String(d.a), price: +d.p, qty: +d.q, side: d.m ? 'sell' : 'buy', ts: d.T });
    }
  });
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
        if (msg.type === 'snapshot') { replaceSide(b.bids, d.b || []); replaceSide(b.asks, d.a || []); }
        else { applySide(b.bids, d.b || []); applySide(b.asks, d.a || []); }
        touch(b);
      } else if (msg.topic.startsWith('publicTrade.')) {
        for (const t of msg.data) {
          addTrade('bybit', market, t.s, { id: String(t.i), price: +t.p, qty: +t.v, side: t.S.toLowerCase(), ts: t.T });
        }
      }
    },
    { ping: JSON.stringify({ op: 'ping' }) }
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
          if (e.type === 'snapshot') { b.bids.clear(); b.asks.clear(); }
          for (const u of e.updates || []) {
            const map = u.side === 'bid' ? b.bids : b.asks;
            const p = +u.price_level, q = +u.new_quantity;
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
    }
  );
}

binance('spot', 'wss://stream.binance.com:9443', CFG.binanceSpot);
binance('futures', 'wss://fstream.binance.com', CFG.binanceFutures);
bybit('spot', CFG.bybitSpot);
bybit('linear', CFG.bybitLinear);
coinbase(CFG.coinbase);

// ---- OANDA account-specific OTC FX pricing -------------------------------
// OANDA supplies account-specific bid/ask price buckets and liquidity, not a
// centralized exchange book or execution tape. Credentials stay server-side.
const OANDA_WANTED = [
  'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD', 'USD_CAD', 'NZD_USD',
  'EUR_GBP', 'EUR_JPY', 'GBP_JPY', 'EUR_CHF', 'AUD_JPY', 'GBP_CHF', 'EUR_AUD',
  'EUR_CAD', 'AUD_CAD', 'AUD_NZD', 'USD_ZAR', 'USD_NGN', 'EUR_NGN', 'GBP_NGN', 'USD_GHS', 'USD_KES',
];
const fxQuotes = new Map();
const fxStatus = { state: process.env.OANDA_ACCOUNT_ID && process.env.OANDA_API_TOKEN ? 'connecting' : 'not_configured', provider: 'OANDA', environment: process.env.OANDA_ENVIRONMENT === 'live' ? 'live' : 'practice', error: null, instruments: 0, updatedAt: null };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runOandaPricing() {
  const accountId = process.env.OANDA_ACCOUNT_ID;
  const token = process.env.OANDA_API_TOKEN;
  if (!accountId || !token) {
    console.log('[oanda-fx] not configured; set OANDA_ACCOUNT_ID and OANDA_API_TOKEN in Render');
    return;
  }
  const live = process.env.OANDA_ENVIRONMENT === 'live';
  const apiHost = live ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com';
  const streamHost = live ? 'https://stream-fxtrade.oanda.com' : 'https://stream-fxpractice.oanda.com';
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  while (true) {
    try {
      fxStatus.state = 'connecting';
      fxStatus.error = null;
      const instrumentsResponse = await fetch(`${apiHost}/v3/accounts/${encodeURIComponent(accountId)}/instruments`, { headers });
      if (!instrumentsResponse.ok) throw new Error(`OANDA instruments request failed (${instrumentsResponse.status})`);
      const instrumentData = await instrumentsResponse.json();
      const available = new Set((instrumentData.instruments || []).map((x) => x.name));
      const instruments = OANDA_WANTED.filter((x) => available.has(x));
      if (!instruments.length) throw new Error('No configured FX pairs are available on this OANDA account');
      fxStatus.instruments = instruments.length;
      console.log(`[oanda-fx] streaming ${instruments.length} account-enabled instruments`);

      const url = new URL(`/v3/accounts/${encodeURIComponent(accountId)}/pricing/stream`, streamHost);
      url.searchParams.set('instruments', instruments.join(','));
      const response = await fetch(url, { headers });
      if (!response.ok || !response.body) throw new Error(`OANDA pricing stream failed (${response.status})`);
      fxStatus.state = 'connected';
      fxStatus.error = null;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let msg;
          try { msg = JSON.parse(line); } catch (_) { continue; }
          if (!msg.instrument || (msg.type && msg.type !== 'PRICE')) continue;
          const bids = (msg.bids || []).map((x) => ({ price: +x.price, liquidity: +x.liquidity })).filter((x) => x.price > 0 && x.liquidity > 0);
          const asks = (msg.asks || []).map((x) => ({ price: +x.price, liquidity: +x.liquidity })).filter((x) => x.price > 0 && x.liquidity > 0);
          const bid = bids.length ? bids[0].price : null;
          const ask = asks.length ? asks[0].price : null;
          fxStatus.state = 'live';
          fxQuotes.set(msg.instrument, {
            instrument: msg.instrument, base: msg.instrument.split('_')[0], quote: msg.instrument.split('_')[1],
            bid, ask, spread: bid != null && ask != null ? ask - bid : null,
            mid: bid != null && ask != null ? (bid + ask) / 2 : null,
            bids, asks, tradeable: !!msg.tradeable, status: msg.status || (msg.tradeable ? 'tradeable' : 'untradeable'),
            time: msg.time || new Date().toISOString(), provider: 'OANDA',
          });
          fxStatus.updatedAt = msg.time || new Date().toISOString();
        }
      }
      fxStatus.state = 'reconnecting';
      console.log('[oanda-fx] pricing stream ended; reconnecting');
    } catch (error) {
      fxStatus.state = 'error';
      fxStatus.error = error.message || 'OANDA connection failed';
      console.error('[oanda-fx]', fxStatus.error);
    }
    await sleep(5000);
  }
}
runOandaPricing();

// ---- Server for your app ----------------------------------------------------

const feedsInfo = () => ({
  live: [...feedStatus.values()].filter(Boolean).length,
  total: feedStatus.size,
  status: Object.fromEntries(feedStatus),
});

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' || req.url !== '/health') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    ok: true,
    service: 'exchange-feed',
    feeds: feedsInfo(),
    books: books.size,
    freshBooks: [...books.values()].filter((b) => b.ts && Date.now() - b.ts <= STALE_MS).length,
    fx: { ...fxStatus, quotes: fxQuotes.size },
  }));
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

const top = (map, desc) =>
  [...map.entries()].sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0])).slice(0, DEPTH);

setInterval(() => {
  const now = Date.now();
  const list = [...books.values()].filter((b) => b.ts).map((b) => {
    const bids = top(b.bids, true), asks = top(b.asks, false);
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
        ts: now, feeds, fxStatus: { ...fxStatus }, fxQuotes: [...fxQuotes.values()],
        books: list.map(({ bids, asks, ...slim }) => (key && slim.base === key ? { ...slim, bids, asks } : slim)),
        trades: key ? trades.filter((t) => t.base === key) : [],
      }));
    }
    c.send(cache.get(key));
  }
}, PUSH_MS);

server.listen(PORT, () => console.log(`Feed server on port ${PORT}`));
