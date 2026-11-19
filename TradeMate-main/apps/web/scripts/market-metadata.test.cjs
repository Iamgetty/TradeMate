'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMarketMetadataRefresher } = require('../public/tm/market-metadata');

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
