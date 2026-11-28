import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerificationServer } from '../dist/server.js';

async function withServer(fn) {
  const server = createVerificationServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  try { await fn(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test('liveness and readiness endpoints respond independently', async () => {
  await withServer(async (base) => {
    const live = await fetch(`${base}/health/live`);
    assert.equal(live.status, 200);
    assert.equal((await live.json()).status, 'ok');
    const ready = await fetch(`${base}/health/ready`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).checks.productCatalogue, 'ok');
  });
});

test('product catalogue exposes independently selectable products', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/products`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.products.some((product) => product.id === 'kyc'));
    assert.ok(body.products.some((product) => product.id === 'kyb'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
});

test('product version endpoint returns only the selected product releases', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/products/kyc/versions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.product, 'kyc');
    assert.deepEqual(body.versions.map((release) => release.version), ['1.0.0']);
  });
});

test('unknown products and routes return structured 404 responses', async () => {
  await withServer(async (base) => {
    const product = await fetch(`${base}/v1/products/not-a-product/versions`);
    assert.equal(product.status, 404);
    assert.equal((await product.json()).error.code, 'product_not_found');
    assert.equal((await fetch(`${base}/v1/unknown`)).status, 404);
  });
});

test('unsupported methods are rejected', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/products`, { method: 'POST' });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  });
});
