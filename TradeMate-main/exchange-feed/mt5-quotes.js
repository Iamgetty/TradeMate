'use strict';

// Read-only MT5 quote cache. This module never connects to a broker terminal
// and has no order/deal functionality.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
const MAX_QUOTES_PER_BATCH = 100;

function normalizeQuote(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid quote');
  const symbol = typeof input.symbol === 'string' ? input.symbol.trim() : '';
  const instrumentType = typeof input.instrumentType === 'string' ? input.instrumentType.trim().toLowerCase() : '';
  const allowedTypes = new Set(['forex', 'metal', 'index_cfd', 'equity_cfd', 'commodity_cfd', 'bond_cfd', 'crypto_cfd']);
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(symbol)) throw new Error('Invalid symbol');
  if (!allowedTypes.has(instrumentType)) throw new Error('Invalid instrument type');
  const bid = input.bid == null ? null : Number(input.bid);
  const ask = input.ask == null ? null : Number(input.ask);
  const last = input.last == null ? null : Number(input.last);
  for (const value of [bid, ask, last]) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) throw new Error('Invalid price');
  }
  if (bid === null && ask === null && last === null) throw new Error('Quote has no price');
  if (bid !== null && ask !== null && bid > ask) throw new Error('Bid exceeds ask');
  const timestamp = typeof input.timestamp === 'number' ? input.timestamp : Date.parse(input.timestamp);
  if (!Number.isFinite(timestamp) || timestamp < now - MAX_AGE_MS || timestamp > now + MAX_FUTURE_SKEW_MS) {
    throw new Error('Invalid quote timestamp');
  }
  const sourceSymbol = typeof input.sourceSymbol === 'string' && /^[A-Za-z0-9._-]{1,32}$/.test(input.sourceSymbol)
    ? input.sourceSymbol : symbol;
  return {
    symbol, sourceSymbol, instrumentType, bid, ask, last,
    timestamp: new Date(timestamp).toISOString(), receivedAt: new Date(now).toISOString(),
    source: 'exness_mt5', stale: now - timestamp > 15000,
  };
}

function createMt5QuoteStore() {
  const quotes = new Map();
  return {
    upsertBatch(batch, now = Date.now()) {
      if (!Array.isArray(batch) || batch.length < 1 || batch.length > MAX_QUOTES_PER_BATCH) {
        throw new Error('Batch must contain 1 to 100 quotes');
      }
      const normalized = batch.map((item) => normalizeQuote(item, now));
      for (const quote of normalized) quotes.set(quote.symbol, quote);
      return normalized.length;
    },
    snapshot(now = Date.now()) {
      return [...quotes.values()].map((quote) => ({
        ...quote,
        stale: now - Date.parse(quote.timestamp) > 15000,
      }));
    },
    get size() { return quotes.size; },
  };
}

module.exports = { normalizeQuote, createMt5QuoteStore };
