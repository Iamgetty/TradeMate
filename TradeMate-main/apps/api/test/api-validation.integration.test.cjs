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
  const queryResponse = await fetch(baseUrl + '/api/market/listings?page=0&limit=999');
  assert.equal(queryResponse.status, 400);

  const pathResponse = await fetch(baseUrl + '/api/market/listings/not-a-uuid');
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

test('support and notification controllers are registered and enforce authentication', async () => {
  const notificationResponse = await fetch(baseUrl + '/api/notifications');
  assert.equal(notificationResponse.status, 401);

  const supportResponse = await fetch(baseUrl + '/api/support/tickets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ category: 'Orders', subject: 'Order issue', message: 'Please help with my order.' }),
  });
  assert.equal(supportResponse.status, 401);
});

test('organization verification document endpoints require an authenticated session', async () => {
  const organizationId = '123e4567-e89b-42d3-a456-426614174000';
  const listResponse = await fetch(baseUrl + '/api/organizations/' + organizationId + '/documents');
  assert.equal(listResponse.status, 401);

  const uploadResponse = await fetch(baseUrl + '/api/organizations/' + organizationId + '/documents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files: [{ fileName: 'certificate.pdf', mimeType: 'application/pdf', dataBase64: 'YQ==' }] }),
  });
  assert.equal(uploadResponse.status, 401);
});

test('contract proposal response and cancellation endpoints require an authenticated session', async () => {
  const contractId = '123e4567-e89b-42d3-a456-426614174000';
  const respondResponse = await fetch(baseUrl + '/api/market/contracts/' + contractId + '/respond', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision: 'accept' }),
  });
  assert.equal(respondResponse.status, 401);

  const cancelResponse = await fetch(baseUrl + '/api/market/contracts/' + contractId + '/cancel', {
    method: 'PATCH',
  });
  assert.equal(cancelResponse.status, 401);
});
