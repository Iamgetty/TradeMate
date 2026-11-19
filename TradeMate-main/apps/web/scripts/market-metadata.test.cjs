'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketMetadataRefresher, applyCoinGeckoMarketMetadata } = require('../public/tm/market-metadata');

test('CoinGecko metadata never becomes the displayed spot price', () => {
  const bitcoin = { p: 64250, c: null, cap: 0, vol: 0 };
  const embeddedLogo = { p: 3200, c: null };
  const logos = {};
  applyCoinGeckoMarketMetadata([
    {
      id: 'bitcoin', current_price: 64000,
      price_change_percentage_24h_in_currency: 2.5,
      price_change_percentage_24h: 2.4,
      market_cap: 1200000000000, total_volume: 25000000000,
      image: 'https://images.example/bitcoin.png',
    },
    {
      id: 'ethereum', current_price: 3100,
      price_change_percentage_24h: -1.25,
      market_cap: 400000000000, total_volume: 10000000000,
      image: 'https://images.example/ethereum.png',
    },
  ], {
    coinIds: { BTC: 'bitcoin', ETH: 'ethereum' },
    findMarketItem: (name) => name === 'BTC/USDT' ? bitcoin : name === 'ETH/USDT' ? embeddedLogo : null,
    isEmbedded: (symbol) => symbol === 'ETH',
    setLogo: (symbol, url) => { logos[symbol] = url; },
  });

  assert.equal(bitcoin.p, 64250, 'exchange-feed spot price remains authoritative');
  assert.equal(bitcoin.c, 2.5);
  assert.equal(bitcoin.cap, 1200000000000);
  assert.equal(bitcoin.vol, 25000000000);
  assert.equal(embeddedLogo.p, 3200);
  assert.equal(embeddedLogo.c, -1.25);
  assert.deepEqual(logos, { BTC: 'https://images.example/bitcoin.png' });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

test('only one metadata request runs at a time and concurrent refreshes share its result', async () => {
  const response = deferred();
  let requests = 0;
  const refresher = createMarketMetadataRefresher({
    fetch: () => { requests += 1; return response.promise; },
    now: () => 100,
  });
  const apply = () => {};
  const first = refresher.refresh({ url: '/markets', apply });
  const second = refresher.refresh({ url: '/markets?later', apply });

  assert.equal(requests, 0, 'fetch starts in the promise microtask');
  await Promise.resolve();
  assert.equal(requests, 1);
  response.resolve({ ok: true, json: async () => [{ id: 'bitcoin' }] });

  assert.deepEqual(await first, { state: 'fresh', count: 1 });
  assert.deepEqual(await second, { state: 'fresh', count: 1 });
  assert.equal(requests, 1);
});

test('a response is discarded when the page is no longer an eligible refresh context', async () => {
  let eligible = true;
  let applied = false;
  const refresher = createMarketMetadataRefresher({
    fetch: async () => ({ ok: true, json: async () => [{ id: 'bitcoin' }] }),
    now: () => 200,
  });

  const result = await refresher.refresh({
    url: '/markets',
    apply: () => { applied = true; },
    isCurrent: () => eligible,
  });
  assert.equal(result.state, 'fresh');
  assert.equal(applied, true);

  eligible = false;
  const ignored = await refresher.refresh({
    url: '/markets',
    apply: () => { applied = true; },
    isCurrent: () => eligible,
  });
  assert.deepEqual(ignored, { state: 'stale', ignored: true });
  assert.equal(refresher.getStatus().state, 'stale');
});

test('failed refresh preserves the last successful timestamp and reports stale state', async () => {
  let attempt = 0;
  const refresher = createMarketMetadataRefresher({
    fetch: async () => {
      attempt += 1;
      if (attempt === 1) return { ok: true, json: async () => [] };
      throw new Error('provider unavailable');
    },
    now: () => attempt * 100,
  });

  await refresher.refresh({ url: '/markets', apply: () => {} });
  const successAt = refresher.getStatus().lastSuccessAt;
  const failed = await refresher.refresh({ url: '/markets', apply: () => {} });

  assert.equal(failed.state, 'stale');
  assert.equal(refresher.getStatus().state, 'stale');
  assert.equal(refresher.getStatus().lastSuccessAt, successAt);
  assert.equal(refresher.getStatus().error, 'provider unavailable');
});

test('a successful refresh recovers from unavailable or stale provider state', async () => {
  let shouldFail = true;
  let clock = 10;
  const refresher = createMarketMetadataRefresher({
    fetch: async () => {
      if (shouldFail) throw new Error('temporary outage');
      return { ok: true, json: async () => [{ id: 'ethereum' }] };
    },
    now: () => clock,
  });

  const failed = await refresher.refresh({ url: '/markets', apply: () => {} });
  assert.equal(failed.state, 'unavailable');
  assert.equal(refresher.getStatus().state, 'unavailable');

  shouldFail = false;
  clock = 20;
  const recovered = await refresher.refresh({ url: '/markets', apply: () => {} });
  assert.deepEqual(recovered, { state: 'fresh', count: 1 });
  assert.equal(refresher.getStatus().lastSuccessAt, 20);
  assert.equal(refresher.getStatus().error, null);
});

test('non-success and malformed provider responses fail closed without applying data', async (t) => {
  for (const response of [
    { ok: false, json: async () => [] },
    { ok: true, json: async () => ({ coins: [] }) },
  ]) {
    let applied = false;
    const refresher = createMarketMetadataRefresher({ fetch: async () => response });
    await refresher.refresh({ url: '/markets', apply: () => { applied = true; } });
    assert.equal(applied, false);
    assert.equal(refresher.getStatus().state, 'unavailable');
  }
});
