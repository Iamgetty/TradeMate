'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuote, createMt5QuoteStore } = require('./mt5-quotes');
const now = Date.now();
const valid = { symbol: 'EURUSD', sourceSymbol: 'EURUSDm', instrumentType: 'forex', bid: 1.08, ask: 1.0802, last: 1.0801, timestamp: now };

test('normalizes a quote and preserves the broker symbol', () => {
  const quote = normalizeQuote(valid, now);
  assert.equal(quote.symbol, 'EURUSD');
  assert.equal(quote.sourceSymbol, 'EURUSDm');
  assert.equal(quote.source, 'exness_mt5');
  assert.equal(quote.stale, false);
});

test('rejects inverted prices, invalid timestamps and unsupported types', () => {
  assert.throws(() => normalizeQuote({ ...valid, bid: 1.09 }, now), /Bid exceeds ask/);
  assert.throws(() => normalizeQuote({ ...valid, timestamp: 'bad' }, now), /timestamp/);
  assert.throws(() => normalizeQuote({ ...valid, timestamp: now + 120000 }, now), /timestamp/);
  assert.throws(() => normalizeQuote({ ...valid, instrumentType: 'equity' }, now), /instrument type/);
});

test('rejects quotes without a valid price and bounds batch size', () => {
  assert.throws(() => normalizeQuote({ ...valid, bid: null, ask: null, last: null }, now), /no price/);
  const store = createMt5QuoteStore();
  assert.throws(() => store.upsertBatch([], now), /1 to 100/);
});

test('stores latest quotes and marks old data stale', () => {
  const store = createMt5QuoteStore();
  assert.equal(store.upsertBatch([valid], now), 1);
  assert.equal(store.snapshot(now + 16000)[0].stale, true);
  assert.equal(store.size, 1);
});
