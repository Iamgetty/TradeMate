const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const WebSocket = require('ws');
const { attachMarketFeed } = require('../dist/market-feed');

let server;
let detach;
let url;
const clients = new Set();

test.before(async () => {
  server = createServer();
  detach = attachMarketFeed(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = 'ws://127.0.0.1:' + server.address().port + '/api/market-feed';
});

test.after(async () => {
  for (const client of clients) {
    try { client.terminate(); } catch { /* already closed */ }
  }
  detach?.();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

function openClient(options = {}) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url, options);
    clients.add(client);
    client.once('open', () => resolve(client));
    client.once('error', reject);
  });
}

function rejectedClient(options = {}) {
  return new Promise((resolve) => {
    const client = new WebSocket(url, options);
    clients.add(client);
    client.once('open', () => resolve({ opened: true }));
    client.once('error', (error) => resolve({ opened: false, error: error.message }));
  });
}

test('market feed rejects an untrusted browser Origin before WebSocket upgrade', async () => {
  const result = await rejectedClient({ headers: { Origin: 'https://attacker.example' } });
  assert.equal(result.opened, false);
  assert.match(result.error, /403/);
});

test('market feed enforces the per-IP concurrent connection ceiling', async () => {
  const accepted = [];
  try {
    for (let i = 0; i < 5; i += 1) accepted.push(await openClient());
    const overflow = await rejectedClient();
    assert.equal(overflow.opened, false);
    assert.match(overflow.error, /429/);
  } finally {
    for (const client of accepted) {
      try { client.close(); } catch { /* already closed */ }
    }
  }
});
