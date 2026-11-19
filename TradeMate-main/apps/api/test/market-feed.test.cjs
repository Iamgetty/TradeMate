const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedMarketFeedOrigin,
  marketFeedClientIp,
  marketFeedBookFreshness,
  marketFeedSequenceAction,
  MARKET_FEED_LIMITS,
} = require('../dist/market-feed');

test('market feed Origin policy allows configured TradeMate web origins', () => {
  assert.equal(isAllowedMarketFeedOrigin(undefined, ''), true);
  assert.equal(isAllowedMarketFeedOrigin('https://trademate-web.onrender.com', ''), true);
  assert.equal(isAllowedMarketFeedOrigin('http://localhost:3000', ''), true);
  assert.equal(isAllowedMarketFeedOrigin('https://preview.example.com', 'https://preview.example.com/'), true);
});

test('market feed Origin policy rejects untrusted and malformed browser origins', () => {
  assert.equal(isAllowedMarketFeedOrigin('https://attacker.example', 'https://app.example.com'), false);
  assert.equal(isAllowedMarketFeedOrigin('null', ''), false);
  assert.equal(isAllowedMarketFeedOrigin('not-an-origin', ''), false);
});

test('market feed client IP uses the right-most valid address from the trusted proxy chain', () => {
  const request = {
    headers: { 'x-forwarded-for': '198.51.100.10, 203.0.113.25' },
    socket: { remoteAddress: '10.0.0.1' },
  };
  assert.equal(marketFeedClientIp(request), '203.0.113.25');
});

test('market feed client IP falls back to the transport peer when forwarding data is invalid', () => {
  const request = {
    headers: { 'x-forwarded-for': 'not-an-ip' },
    socket: { remoteAddress: '10.0.0.2' },
  };
  assert.equal(marketFeedClientIp(request), '10.0.0.2');
});

test('market feed resource ceilings remain explicit and bounded', () => {
  assert.equal(MARKET_FEED_LIMITS.maxConnections, 100);
  assert.equal(MARKET_FEED_LIMITS.maxConnectionsPerIp, 5);
  assert.equal(MARKET_FEED_LIMITS.subscriptionTimeoutMs, 10_000);
  assert.equal(MARKET_FEED_LIMITS.maxBufferedBytes, 1_048_576);
  assert.equal(MARKET_FEED_LIMITS.maxBackpressureStrikes, 3);
  assert.equal(MARKET_FEED_LIMITS.bookFreshnessMs, 10_000);
  assert.equal(Object.isFrozen(MARKET_FEED_LIMITS), true);
});

test('market feed book freshness treats missing timestamps as stale', () => {
  assert.deepEqual(marketFeedBookFreshness(0, 20_000), { stale: true, ageMs: null });
  assert.deepEqual(marketFeedBookFreshness(Number.NaN, 20_000), { stale: true, ageMs: null });
});

test('market feed book freshness accepts data at the configured boundary', () => {
  assert.deepEqual(
    marketFeedBookFreshness(10_000, 20_000),
    { stale: false, ageMs: MARKET_FEED_LIMITS.bookFreshnessMs },
  );
});

test('market feed book freshness expires data older than the configured threshold', () => {
  assert.deepEqual(
    marketFeedBookFreshness(9_999, 20_000),
    { stale: true, ageMs: MARKET_FEED_LIMITS.bookFreshnessMs + 1 },
  );
});

test('market feed book freshness clamps small future clock skew to zero age', () => {
  assert.deepEqual(marketFeedBookFreshness(20_100, 20_000), { stale: false, ageMs: 0 });
});

test('Bybit order-book deltas require an exact previous update ID', () => {
  assert.equal(marketFeedSequenceAction(100, 101, 100, 'previous'), 'apply');
  assert.equal(marketFeedSequenceAction(100, 102, 100, 'previous'), 'apply');
  assert.equal(marketFeedSequenceAction(100, 101, 99, 'previous'), 'resync');
  assert.equal(marketFeedSequenceAction(null, 101, 100, 'previous'), 'resync');
});

test('Coinbase level2 updates require contiguous sequence numbers', () => {
  assert.equal(marketFeedSequenceAction(200, 201, undefined, 'incremental'), 'apply');
  assert.equal(marketFeedSequenceAction(200, 202, undefined, 'incremental'), 'resync');
  assert.equal(marketFeedSequenceAction(200, 200, undefined, 'incremental'), 'ignore');
});

test('sequence validation rejects unsafe and malformed sequence values', () => {
  assert.equal(marketFeedSequenceAction(1, 'not-a-sequence', 1, 'previous'), 'resync');
  assert.equal(marketFeedSequenceAction(1, Number.MAX_SAFE_INTEGER + 1, 1, 'previous'), 'resync');
});
