// feed-client.js: no UI, no styling. Paste into your app (or load with <script>).
// It connects to the feed backend, combines the order books of every live
// exchange into ONE aggregated book (same-price quantities added together),
// and calls onUpdate once per second with plain data for YOUR own screens.
//
// const feed = createFeedClient({
//   url: 'wss://your-feed.onrender.com',
//   base: 'BTC', quote: 'USDT',
//   onUpdate(d) { /* render Book / Trades with your own components */ },
// });

(function (root) {
  const USD_LIKE = ['USD', 'USDT', 'USDC', 'BUSD'];

  function createFeedClient(opts, runtime = {}) {
    const o = Object.assign({
      url: '',
      base: 'BTC',
      quote: 'USDT',
      markets: ['spot'],        // add 'futures' (Binance) and 'linear' (Bybit) to include futures books
      mixUsdQuotes: true,       // treat USD, USDT, USDC as one quote so Coinbase USD books combine
      levels: 12,               // rows per side
      tick: 0,                  // price grouping step, e.g. 0.5; 0 = exact prices
      maxTrades: 50,
      reconnectBaseMs: 1000,
      reconnectMaxMs: 30000,
      stableConnectionMs: 30000,
      onUpdate() {},
      onStatus() {},            // called with true/false when the socket connects/disconnects
    }, opts);

    const WebSocketImpl = runtime.WebSocket || root.WebSocket;
    const setTimer = runtime.setTimeout || setTimeout;
    const clearTimer = runtime.clearTimeout || clearTimeout;
    const random = runtime.random || Math.random;
    let ws, attempt = 0, closed = false, trades = [];
    let reconnectTimer = null, stableTimer = null;
    const seenTradeIds = new Set();
    const tradeKey = (t) => t.id != null && t.id !== ''
      ? [t.exchange, t.market, t.symbol, t.id].join('|')
      : [t.exchange, t.market, t.symbol, t.ts, t.price, t.qty, t.side].join('|');

    const quoteOk = (q) => o.mixUsdQuotes && USD_LIKE.includes(o.quote)
      ? USD_LIKE.includes(q)
      : q === o.quote;
    const matches = (x) => x.base === o.base && quoteOk(x.quote) && o.markets.includes(x.market);

    const round = (n) => +n.toFixed(8);
    const bucket = (price, side) => {
      if (!o.tick) return price;
      return round((side === 'bid' ? Math.floor(price / o.tick) : Math.ceil(price / o.tick)) * o.tick);
    };

    function aggregate(levels, side) {
      const m = new Map();
      for (const [p, s] of levels) {
        const k = bucket(p, side);
        m.set(k, (m.get(k) || 0) + s);
      }
      const rows = [...m.entries()]
        .sort((a, b) => (side === 'bid' ? b[0] - a[0] : a[0] - b[0]))
        .slice(0, o.levels);
      let running = 0;
      return rows.map(([price, size]) => ({ price, size, total: (running += size) }));
    }

    function clearMarketData() {
      trades = [];
      seenTradeIds.clear();
      o.onUpdate({
        symbol: `${o.base}/${o.quote}`,
        bids: [], asks: [], bestBid: null, bestAsk: null, mid: null, spread: null,
        last: null, trades: [], booksCombined: 0,
        feedsLive: 0, feedsTotal: 0, fxQuotes: [], marketQuotes: [], mt5Quotes: [], mt5PublicBroadcastEnabled: false, ts: Date.now(),
      });
    }

    function handle(msg) {
      // Ignore malformed snapshots instead of letting one bad packet stop feed updates.
      if (!msg || !Array.isArray(msg.books) || !msg.feeds || typeof msg.feeds !== 'object') return;
      const fresh = msg.books.filter((b) => b && matches(b) && !b.stale);
      const bids = aggregate(fresh.flatMap((b) => b.bids || []), 'bid');
      const asks = aggregate(fresh.flatMap((b) => b.asks || []), 'ask');

      // The server sends only trades received since its previous one-second
      // snapshot. Still deduplicate by execution identity so reconnects or
      // repeated packets cannot print the same execution twice.
      const incoming = (Array.isArray(msg.trades) ? msg.trades : []).filter(matches).reverse()
        .map((t) => ({ id: t.id, exchange: t.exchange, market: t.market, symbol: t.symbol, ts: t.ts, price: t.price, qty: t.qty, side: t.side }));
      const unseen = [];
      for (const t of incoming) {
        const id = tradeKey(t);
        if (seenTradeIds.has(id)) continue;
        seenTradeIds.add(id);
        unseen.push(t);
      }
      trades = unseen.concat(trades).slice(0, o.maxTrades);
      while (seenTradeIds.size > o.maxTrades * 20) {
        const oldest = seenTradeIds.values().next().value;
        seenTradeIds.delete(oldest);
      }

      const bestBid = bids.length ? bids[0].price : null;
      const bestAsk = asks.length ? asks[0].price : null;
      const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;

      o.onUpdate({
        symbol: `${o.base}/${o.quote}`,
        bids, asks,                                   // [{ price, size, total }] best first
        bestBid, bestAsk, mid,
        spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null,
        last: trades.length ? trades[0].price : mid,
        trades,                                       // [{ exchange, market, ts, price, qty, side }] newest first
        booksCombined: fresh.length,                  // "N exchange books combined"
        feedsLive: Number.isFinite(msg.feeds.live) ? msg.feeds.live : 0, // "N/M FEEDS LIVE"
        feedsTotal: Number.isFinite(msg.feeds.total) ? msg.feeds.total : 0,
        fxQuotes: Array.isArray(msg.fxQuotes) ? msg.fxQuotes : [],
        // Expose fresh spot best-bid/ask/last data for the market catalogue.
        marketQuotes: Array.isArray(msg.books) ? msg.books.filter((b) => b && b.market === 'spot' && !b.stale).map((b) => ({
          base: b.base, quote: b.quote, bid: b.bid, ask: b.ask, last: b.last,
          exchange: b.exchange, market: b.market,
        })) : [],
        mt5Quotes: Array.isArray(msg.mt5Quotes) ? msg.mt5Quotes : [],
        mt5PublicBroadcastEnabled: msg.mt5PublicBroadcastEnabled === true,
        fxStatus: msg.fxStatus || { state: 'unavailable', provider: 'OANDA' },
        ts: msg.ts,
      });
    }

    // Tell the server which coin is on screen so it sends full depth for that one only
    function watch() {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: 'watch', base: o.base }));
    }

    function clearStableTimer() {
      if (stableTimer !== null) clearTimer(stableTimer);
      stableTimer = null;
    }

    function scheduleReconnect() {
      if (closed || reconnectTimer !== null) return;
      const ceiling = Math.min(o.reconnectMaxMs, o.reconnectBaseMs * (2 ** attempt));
      attempt += 1;
      const sample = Math.max(0, Math.min(1, Number(random()) || 0));
      const delay = Math.floor(ceiling / 2 + sample * ceiling / 2);
      reconnectTimer = setTimer(() => {
        reconnectTimer = null;
        open();
      }, delay);
    }

    function open() {
      if (closed) return;
      let socket;
      try {
        socket = new WebSocketImpl(o.url);
      } catch (e) {
        o.onStatus(false);
        scheduleReconnect();
        return;
      }
      ws = socket;
      let receivedMessage = false;
      socket.onopen = () => {
        watch();
        o.onStatus(true);
        clearStableTimer();
        stableTimer = setTimer(() => {
          stableTimer = null;
          // A handshake alone is not evidence of a healthy feed. Reset only
          // after a sustained connection has also delivered valid data.
          if (!closed && ws === socket && socket.readyState === 1 && receivedMessage) attempt = 0;
        }, o.stableConnectionMs);
      };
      socket.onmessage = (ev) => {
        try {
          const message = JSON.parse(ev.data);
          handle(message);
          if (message && Array.isArray(message.books) && message.feeds && typeof message.feeds === 'object') receivedMessage = true;
        } catch (e) {
          console.error('feed parse error', e);
        }
      };
      socket.onclose = () => {
        clearMarketData();
        o.onStatus(false);
        clearStableTimer();
        scheduleReconnect();
      };
    }
    open();

    return {
      close() {
        closed = true;
        if (reconnectTimer !== null) clearTimer(reconnectTimer);
        reconnectTimer = null;
        clearStableTimer();
        if (ws) ws.close();
      },
      setSymbol(base, quote) {
        if (o.base === base && o.quote === quote) return;
        o.base = base; o.quote = quote;
        clearMarketData();
        watch();
      },   // call when the user switches pair
    };
  }

  root.createFeedClient = createFeedClient;
  if (typeof module !== 'undefined') module.exports = { createFeedClient };
})(typeof window !== 'undefined' ? window : globalThis);
