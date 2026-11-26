const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApiJsonBodyParser } = require('../dist/request-body-parser');

const startServer = async () => {
  const app = express();
  app.use(createApiJsonBodyParser());
  app.post('/api/integrations/persona/webhook', (request, response) => {
    response.json({
      rawBody: request.rawBody?.toString('utf8') ?? null,
      parsed: request.body,
    });
  });
  app.post('/api/other', (request, response) => {
    response.json({ rawBody: request.rawBody?.toString('utf8') ?? null });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};

test('captures exact raw JSON bytes only for the Persona webhook endpoint', async () => {
  const server = await startServer();
  try {
    const raw = '{ "data" : { "id" : "evt_test123" } }';
    const response = await fetch(server.url + '/api/integrations/persona/webhook?delivery=1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.rawBody, raw);
    assert.deepEqual(result.parsed, { data: { id: 'evt_test123' } });

    const other = await fetch(server.url + '/api/other', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    });
    assert.deepEqual(await other.json(), { rawBody: null });
  } finally {
    await server.close();
  }
});
