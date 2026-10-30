// feed-client.js: no UI, no styling. Paste into your app (or load with <script>).
// It connects to the feed backend and exposes each exchange/market order book
// independently, plus a shared venue-labelled execution tape.
//
// const feed = createFeedClient({
//   url: 'wss://your-feed.onrender.com',
//   base: 'BTC', quote: 'USDT',
//   onUpdate(d) { /* render Book / Trades with your own components */ },
// });

(function (root) {
  const USD_LIKE = ['USD', 'USDT', 'USDC', 'BUSD'];

  function createFeedClient(opts) {
    const o = Object.assign({
      url: '',
      base: 'BTC',
      quote: 'USDT',
      markets: ['spot'],        // add 'futures' (Binance) and 'linear' (Bybit) to include futures books
      mixUsdQuotes: true,       // include USD-like venues, but preserve each book's quote label
      levels: 12,               // rows per side
      tick: 0,                  // price grouping step, e.g. 0.5; 0 = exact prices
      maxTrades: 50,
      onUpdate() {},
      onStatus() {},            // called with true/false when the socket connects/disconnects
    }, opts);

    let ws, attempt = 0, closed = false, trades = [];

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

    function handle(msg) {
      const fresh = msg.books.filter((b) => matches(b) && !b.stale);
      const bids = aggregate(fresh.flatMap((b) => b.bids || []), 'bid');
      const asks = aggregate(fresh.flatMap((b) => b.asks || []), 'ask');

      const incoming = msg.trades.filter(matches).reverse()
        .map((t) => ({ exchange: t.exchange, market: t.market, quote: t.quote, ts: t.ts, price: t.price, qty: t.qty, side: t.side }));
      trades = incoming.concat(trades).slice(0, o.maxTrades);   // newest first

      const bestBid = bids.length ? bids[0].price : null;
      const bestAsk = asks.length ? asks[0].price : null;
      const mid = bestBid != null && bestAsk != null ? (bestBid + bestAsk) / 2 : null;
      // Preserve each venue/market book as its own independent book. The
      // aggregate fields remain for compatibility, but TradeMate renders books[].
      const books = fresh.map((b) => ({
        exchange: b.exchange,
        market: b.market,
        symbol: b.symbol,
        quote: b.quote,
        bids: (b.bids || []).map(([price, size]) => ({ price: +price, size: +size })),
        asks: (b.asks || []).map(([price, size]) => ({ price: +price, size: +size })),
        stale: !!b.stale,
      }));

      o.onUpdate({
        symbol: `${o.base}/${o.quote}`,
        books,
        bids, asks,
        bestBid, bestAsk, mid,
        spread: bestBid != null && bestAsk != null ? bestAsk - bestBid : null,
        last: trades.length ? trades[0].price : mid,
        trades,
        booksCombined: fresh.length,
        feedsLive: msg.feeds.live,
        feedsTotal: msg.feeds.total,
        fxQuotes: msg.fxQuotes || [],
        fxStatus: msg.fxStatus || { state: 'unavailable', provider: 'OANDA' },
        ts: msg.ts,
      });
    }

    // Tell the server which coin is on screen so it sends full depth for that one only
    function watch() {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: 'watch', base: o.base }));
    }

    function open() {
      ws = new WebSocket(o.url);
      ws.onopen = () => { attempt = 0; watch(); o.onStatus(true); };
      ws.onmessage = (ev) => { try { handle(JSON.parse(ev.data)); } catch (e) { console.error('feed parse error', e); } };
      ws.onclose = () => {
        o.onStatus(false);
        if (!closed) setTimeout(open, Math.min(15000, 1000 * 2 ** attempt++));
      };
    }
    open();

    return {
      close() { closed = true; ws.close(); },
      setSymbol(base, quote) { o.base = base; o.quote = quote; trades = []; watch(); },   // call when the user switches pair
    };
  }

  root.createFeedClient = createFeedClient;
  if (typeof module !== 'undefined') module.exports = { createFeedClient };
})(typeof window !== 'undefined' ? window : globalThis);
