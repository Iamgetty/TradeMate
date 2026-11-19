const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isAllowedMarketFeedOrigin,
  marketFeedClientIp,
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
  assert.equal(Object.isFrozen(MARKET_FEED_LIMITS), true);
});
