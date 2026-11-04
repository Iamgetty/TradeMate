// Multi-exchange live feed (data only, no UI).
// Binance (spot + futures), Bybit (spot + linear futures), Coinbase (spot).
// Keeps live order-book depth and trades per exchange, and pushes ONE JSON
// snapshot per second to every connected client (your app).
//
// Run: npm install && npm start
// Health check: GET /health

const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
const { createMt5QuoteStore } = require('./mt5-quotes');
const mt5QuoteStore = createMt5QuoteStore();

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
    b = { exchange, market, symbol, ...splitSymbol(symbol), bids: new Map(), asks: new Map(), ts: 0, last: null, synced: false, lastUpdateId: 0 };
    books.set(k, b);
  }
  return b;
}
const touch = (b) => { b.ts = Date.now(); };
function resetBooks(exchange, market) {
  for (const b of books.values()) {
    if (b.exchange !== exchange || b.market !== market) continue;
    b.bids.clear();
    b.asks.clear();
    b.ts = 0;
    b.synced = false;
    b.lastUpdateId = 0;
  }
}
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
      // A reconnect starts a new order-book session; require fresh snapshots.
      resetBooks('bybit', market);
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
        if (msg.type === 'snapshot' || Number(d.u) === 1) {
          replaceSide(b.bids, d.b || []);
          replaceSide(b.asks, d.a || []);
          b.synced = true;
          b.lastUpdateId = Number(d.u) || 0;
        } else {
          // Never expose a partial Bybit book before its initial snapshot.
          if (!b.synced) return;
          const updateId = Number(d.u);
          if (!Number.isFinite(updateId) || updateId <= b.lastUpdateId) return;
          applySide(b.bids, d.b || []);
          applySide(b.asks, d.a || []);
          b.lastUpdateId = updateId;
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
      // Do not carry a previous Coinbase book across a new socket session.
      resetBooks('coinbase', 'spot');
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

// ---- OANDA account-specific OTC FX pricing -------------------------------
// OANDA supplies account-specific bid/ask price buckets and liquidity, not a
// centralized exchange book or execution tape. Credentials stay server-side.
const OANDA_WANTED = [
  'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF', 'AUD_USD', 'USD_CAD', 'NZD_USD',
  'EUR_GBP', 'EUR_JPY', 'GBP_JPY', 'EUR_CHF', 'AUD_JPY', 'GBP_CHF', 'EUR_AUD',
  'EUR_CAD', 'AUD_CAD', 'AUD_NZD', 'USD_ZAR', 'USD_NGN', 'EUR_NGN', 'GBP_NGN', 'USD_GHS', 'USD_KES',
];
const fxQuotes = new Map();
const useTwelveData = !!process.env.TWELVE_DATA_API_KEY;
const fxStatus = { state: useTwelveData ? 'connecting' : (process.env.OANDA_ACCOUNT_ID && process.env.OANDA_API_TOKEN ? 'connecting' : 'not_configured'), provider: useTwelveData ? 'Twelve Data' : 'OANDA', plan: useTwelveData ? 'Basic' : null, quoteType: useTwelveData ? 'reference_only' : 'account_otc', refreshMinutes: useTwelveData ? 30 : null, error: null, instruments: 0, updatedAt: null };

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
const TWELVE_DATA_WANTED = [
  { symbol: 'EUR/USD', instrument: 'EUR_USD', assetClass: 'Forex' },
  { symbol: 'GBP/USD', instrument: 'GBP_USD', assetClass: 'Forex' },
  { symbol: 'USD/JPY', instrument: 'USD_JPY', assetClass: 'Forex' },
  { symbol: 'USD/CHF', instrument: 'USD_CHF', assetClass: 'Forex' },
  { symbol: 'AAPL', instrument: 'AAPL', assetClass: 'Equities' },
  { symbol: 'MSFT', instrument: 'MSFT', assetClass: 'Equities' },
  { symbol: 'NVDA', instrument: 'NVDA', assetClass: 'Equities' },
  { symbol: 'AMZN', instrument: 'AMZN', assetClass: 'Equities' },
];
async function runTwelveDataPricing() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return;
  const refreshInterval = 30 * 60 * 1000;
  while (true) {
    const cycleStarted = Date.now();
    fxStatus.state = fxQuotes.size ? 'refreshing' : 'connecting';
    fxStatus.error = null;
    let successful = 0;
    let lastError = null;
    for (let i = 0; i < TWELVE_DATA_WANTED.length; i++) {
      const item = TWELVE_DATA_WANTED[i];
      try {
        const url = new URL('https://api.twelvedata.com/price');
        url.searchParams.set('symbol', item.symbol);
        url.searchParams.set('apikey', apiKey);
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        const payload = await response.json().catch(() => ({}));
        const price = Number(payload && payload.price);
        if (!response.ok || !Number.isFinite(price) || price <= 0) {
          const detail = payload && payload.message ? String(payload.message).slice(0, 180) : '';
          throw new Error('Twelve Data request failed (' + response.status + ')' + (detail ? ': ' + detail : ''));
        }
        const parts = item.symbol.split('/');
        const timestamp = new Date().toISOString();
        fxQuotes.set(item.instrument, {
          instrument: item.instrument, symbol: item.symbol, base: parts[0] || null, quote: parts[1] || null,
          assetClass: item.assetClass, bid: null, ask: null, spread: null, mid: price, price,
          bids: [], asks: [], tradeable: false, status: 'reference_only',
          quoteType: 'reference_only', time: timestamp, provider: 'Twelve Data',
        });
        successful++;
        fxStatus.updatedAt = timestamp;
      } catch (error) {
        lastError = error.message || 'Twelve Data request failed';
        console.error('[twelvedata-basic] ' + item.symbol + ': ' + lastError);
      }
      if (i < TWELVE_DATA_WANTED.length - 1) await sleep(8500);
    }
    fxStatus.instruments = fxQuotes.size;
    fxStatus.state = successful || fxQuotes.size ? 'available' : 'error';
    fxStatus.error = successful ? null : lastError;
    console.log('[twelvedata-basic] refreshed ' + successful + '/' + TWELVE_DATA_WANTED.length + ' mixed FX/equity reference prices');
    await sleep(Math.max(1000, refreshInterval - (Date.now() - cycleStarted)));
  }
}

if (useTwelveData) runTwelveDataPricing(); else runOandaPricing();

// ---- Server for your app ----------------------------------------------------
const feedsInfo = () => {
  const now = Date.now();
  const status = Object.fromEntries([...feedStatus].map(([name, connected]) => {
    const active = connected && now - (feedLastMessage.get(name) || 0) <= FEED_IDLE_MS;
    return [name, active];
  }));
  return { live: Object.values(status).filter(Boolean).length, total: feedStatus.size, status };
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
function authorizedMt5Request(req) {
  const expected = process.env.MT5_INGEST_TOKEN || '';
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, feeds: feedsInfo(), books: books.size, mt5Quotes: mt5QuoteStore.size, fx: { ...fxStatus, quotes: fxQuotes.size } });
  }
  if (req.method === 'GET' && req.url === '/mt5/quotes') {
    if (!authorizedMt5Request(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { source: 'exness_mt5', quotes: mt5QuoteStore.snapshot(), fetchedAt: new Date().toISOString() });
  }
  if (req.method === 'POST' && req.url === '/mt5/quotes') {
    if (!authorizedMt5Request(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body) > 65536) {
        tooLarge = true;
        body = '';
      }
    });
    req.on('end', () => {
      if (tooLarge) return sendJson(res, 413, { error: 'Payload too large' });
      try {
        const payload = JSON.parse(body);
        const accepted = mt5QuoteStore.upsertBatch(payload.quotes);
        sendJson(res, 202, { accepted, source: 'exness_mt5' });
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid quote payload' });
      }
    });
    return;
  }
  return sendJson(res, 404, { error: 'Not found' });
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
        // MT5 quotes remain behind the authenticated REST endpoint until redistribution is approved.
        ts: now, feeds, fxStatus: { ...fxStatus }, fxQuotes: [...fxQuotes.values()],
        books: list.map(({ bids, asks, ...slim }) => (key && slim.base === key ? { ...slim, bids, asks } : slim)),
        trades: key ? trades.filter((t) => t.base === key) : [],
      }));
    }
    // A slow client must not accumulate an unbounded queue of stale snapshots.
    if (c.bufferedAmount > 1024 * 1024) {
      c.terminate();
      continue;
    }
    c.send(cache.get(key));
  }
}, PUSH_MS);

server.listen(PORT, () => console.log(`Feed server on port ${PORT}`));
