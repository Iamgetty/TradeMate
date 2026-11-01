require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');

let app;
let baseUrl;

test.before(async () => {
  // Exercise the real Nest HTTP pipeline without connecting to production data.
  delete process.env.DATABASE_URL;
  const { AppModule } = require('../dist/module');
  app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  app.use(json({ limit: '28mb' }));
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  baseUrl = 'http://127.0.0.1:' + address.port;
});

test.after(async () => {
  if (app) await app.close();
});

test('health endpoint responds through the actual Nest server', async () => {
  const response = await fetch(baseUrl + '/api/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});

test('malformed registration is rejected before database access', async () => {
  const response = await fetch(baseUrl + '/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: 'short', displayName: 'x' }),
  });
  assert.equal(response.status, 400);
});

test('invalid marketplace query and UUID path values are rejected', async () => {
  const queryResponse = await fetch(baseUrl + '/api/marketplace?page=0&limit=999');
  assert.equal(queryResponse.status, 400);

  const pathResponse = await fetch(baseUrl + '/api/marketplace/not-a-uuid');
  assert.equal(pathResponse.status, 400);
});

test('invalid P2P filters are rejected before database access', async () => {
  const response = await fetch(baseUrl + '/api/p2p/book?side=short');
  assert.equal(response.status, 400);
});

test('invalid support payload is rejected before authentication or database access', async () => {
  const response = await fetch(baseUrl + '/api/support/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'not-a-category', subject: '', message: '' }),
  });
  assert.equal(response.status, 400);
});
