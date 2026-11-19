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
  // Finish every client close before closing the HTTP server. Calling
  // terminate() and immediately invoking server.close() can leave upgraded
  // sockets alive long enough for server.close() to wait indefinitely.
  await Promise.all([...clients].map((client) => {
    if (client.readyState === WebSocket.CLOSED) return Promise.resolve();
    return new Promise((resolve) => {
      client.once('close', resolve);
      client.terminate();
    });
  }));
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

const { EventEmitter } = require('node:events');

class FakeUpstreamSocket extends EventEmitter {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    this.sent = [];
  }
  open() {
    this.readyState = WebSocket.OPEN;
    this.emit('open');
  }
  send(payload) { this.sent.push(String(payload)); }
  message(payload) { this.emit('message', Buffer.from(JSON.stringify(payload))); }
  close() {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
  terminate() { this.close(); }
}

function waitForSnapshot(client, predicate, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.removeListener('message', onMessage);
      reject(new Error('Timed out waiting for a matching market-feed snapshot.'));
    }, timeoutMs);
    const onMessage = (raw) => {
      let payload;
      try { payload = JSON.parse(raw.toString()); } catch { return; }
      if (payload.type !== 'snapshot' || !predicate(payload)) return;
      clearTimeout(timeout);
      client.removeListener('message', onMessage);
      resolve(payload);
    };
    client.on('message', onMessage);
  });
}

test('Bybit book lifecycle applies ordered deltas, ignores duplicates, and recovers after a gap', async () => {
  const upstream = [];
  const lifecycleServer = createServer();
  const lifecycleDetach = attachMarketFeed(lifecycleServer, {
    createUpstreamSocket: (target, options) => {
      const socket = new FakeUpstreamSocket(target);
      socket.handshakeOptions = options;
      upstream.push(socket);
      return socket;
    },
  });
  await new Promise((resolve) => lifecycleServer.listen(0, '127.0.0.1', resolve));
  const lifecycleUrl = 'ws://127.0.0.1:' + lifecycleServer.address().port + '/api/market-feed';
  const client = new WebSocket(lifecycleUrl);
  try {
    await new Promise((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });
    client.send(JSON.stringify({ type: 'subscribe', symbol: 'BTCUSD' }));

    const bybitSpot = () => upstream.find((socket) => socket.url === 'wss://stream.bybit.com/v5/public/spot');
    const waitForSocket = async (minimumCount) => {
      const deadline = Date.now() + 2500;
      while (upstream.filter((socket) => socket.url === 'wss://stream.bybit.com/v5/public/spot').length < minimumCount) {
        if (Date.now() > deadline) throw new Error('Bybit spot socket was not created.');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return upstream.filter((socket) => socket.url === 'wss://stream.bybit.com/v5/public/spot')[minimumCount - 1];
    };

    const firstSocket = await waitForSocket(1);
    firstSocket.open();
    firstSocket.message({
      topic: 'orderbook.50.BTCUSD',
      type: 'snapshot',
      data: { u: 100, b: [['100', '2']], a: [['101', '3']] },
    });
    let snapshot = await waitForSnapshot(client, (payload) =>
      payload.feeds.some((feed) => feed.venue === 'bybit' && feed.market === 'spot' &&
        feed.sequenceStatus === 'synchronized' && feed.sequence === 100));
    let book = snapshot.books.find((feed) => feed.venue === 'bybit' && feed.market === 'spot');
    assert.equal(book.bids[0].q, '2');
    assert.equal(book.asks[0].q, '3');

    firstSocket.message({
      topic: 'orderbook.50.BTCUSD',
      type: 'delta',
      data: { u: 101, b: [['100', '4']], a: [] },
    });
    snapshot = await waitForSnapshot(client, (payload) =>
      payload.feeds.some((feed) => feed.venue === 'bybit' && feed.market === 'spot' && feed.sequence === 101));
    book = snapshot.books.find((feed) => feed.venue === 'bybit' && feed.market === 'spot');
    assert.equal(book.bids[0].q, '4');

    firstSocket.message({
      topic: 'orderbook.50.BTCUSD',
      type: 'delta',
      data: { u: 100, b: [['100', '99']], a: [] },
    });
    snapshot = await waitForSnapshot(client, (payload) =>
      payload.feeds.some((feed) => feed.venue === 'bybit' && feed.market === 'spot' && feed.sequence === 101));
    book = snapshot.books.find((feed) => feed.venue === 'bybit' && feed.market === 'spot');
    assert.equal(book.bids[0].q, '4', 'older updates must not overwrite the current book');

    firstSocket.message({
      topic: 'orderbook.50.BTCUSD',
      type: 'delta',
      data: { u: 103, b: [['100', '8']], a: [] },
    });
    snapshot = await waitForSnapshot(client, (payload) =>
      payload.feeds.some((feed) => feed.venue === 'bybit' && feed.market === 'spot' &&
        feed.sequenceStatus === 'gap' && feed.stale));
    book = snapshot.books.find((feed) => feed.venue === 'bybit' && feed.market === 'spot');
    assert.equal(book.bids.length, 0, 'a gap must invalidate the old book');
    assert.equal(firstSocket.readyState, WebSocket.CLOSED, 'a gap must close the upstream socket');

    const replacementSocket = await waitForSocket(2);
    replacementSocket.open();
    replacementSocket.message({
      topic: 'orderbook.50.BTCUSD',
      type: 'snapshot',
      data: { u: 200, b: [['99', '5']], a: [['102', '6']] },
    });
    snapshot = await waitForSnapshot(client, (payload) =>
      payload.feeds.some((feed) => feed.venue === 'bybit' && feed.market === 'spot' &&
        feed.sequenceStatus === 'synchronized' && feed.sequence === 200));
    book = snapshot.books.find((feed) => feed.venue === 'bybit' && feed.market === 'spot');
    assert.equal(book.stale, false);
    assert.equal(book.bids[0].p, '99');
    assert.equal(book.bids[0].q, '5');
  } finally {
    if (client.readyState !== WebSocket.CLOSED) {
      await new Promise((resolve) => {
        client.once('close', resolve);
        client.terminate();
      });
    }
    lifecycleDetach();
    if (lifecycleServer.listening) await new Promise((resolve) => lifecycleServer.close(resolve));
  }
});
