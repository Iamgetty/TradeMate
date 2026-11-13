'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReadiness } = require('./readiness');

const fixture = (overrides = {}) => ({
  feedStatus: new Map([['binance-spot', true], ['bybit-spot', false]]),
  feedLastMessage: new Map([['binance-spot', 9500]]),
  books: [{ ts: 9800 }, { ts: 1000 }, { ts: 0 }],
  now: 10000,
  feedIdleMs: 30000,
  staleMs: 5000,
  fxStatus: { state: 'available', updatedAt: '1970-01-01T00:00:09.000Z', quoteCount: 4 },
  ...overrides,
});

test('readiness reports healthy market data and separately counts stale books', () => {
  const result = buildReadiness(fixture());
  assert.equal(result.ready, true);
  assert.equal(result.status, 'degraded');
  assert.deepEqual(result.feeds, {
    live: 1,
    total: 2,
    providers: {
      'binance-spot': { live: true, lastMessageAgeMs: 500 },
      'bybit-spot': { live: false, lastMessageAgeMs: null },
    },
  });
  assert.deepEqual(result.books, { observed: 2, fresh: 1, stale: 1 });
  assert.equal(result.fx.lastUpdateAgeMs, 1000);
});

test('readiness degrades when no upstream feed is active', () => {
  const result = buildReadiness(fixture({
    feedStatus: new Map([['binance-spot', false]]),
    feedLastMessage: new Map([['binance-spot', 9500]]),
  }));
  assert.equal(result.ready, false);
  assert.equal(result.status, 'degraded');
});

test('readiness degrades when no fresh order book is available', () => {
  const result = buildReadiness(fixture({ books: [{ ts: 1000 }, { ts: 0 }] }));
  assert.equal(result.ready, false);
  assert.deepEqual(result.books, { observed: 1, fresh: 0, stale: 1 });
});

test('readiness never exposes provider error text or credentials', () => {
  const result = buildReadiness(fixture({
    fxStatus: { state: 'error', error: 'private provider detail', updatedAt: null, quoteCount: 0 },
  }));
  assert.equal(JSON.stringify(result).includes('private provider detail'), false);
});
