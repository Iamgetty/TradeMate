'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFeedClient: createServiceFeedClient } = require('./feed-client');
const { createFeedClient: createDeployedWebFeedClient } = require('../apps/web/public/tm/feed-client');

function harness(createFeedClient, random = () => 0.5) {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(value) { this.sent.push(JSON.parse(value)); }
    open() { this.readyState = 1; this.onopen?.(); }
    message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
    drop() { this.readyState = 3; this.onclose?.(); }
    close() { this.readyState = 3; this.onclose?.(); }
  }
  function setTimeoutFn(fn, delay) {
    const id = nextId++;
    timers.set(id, { fn, at: now + delay });
    return id;
  }
  function clearTimeoutFn(id) { timers.delete(id); }
  function advance(ms) {
    const end = now + ms;
    while (true) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
    }
    now = end;
  }
  return {
    sockets,
    advance,
    create() {
      return createFeedClient({ url: 'wss://feed.test', stableConnectionMs: 30000 }, {
        WebSocket: FakeWebSocket, setTimeout: setTimeoutFn, clearTimeout: clearTimeoutFn, random,
      });
    },
  };
}

const validSnapshot = {
  books: [], trades: [], feeds: { live: 1, total: 1 }, ts: 1,
};

for (const [label, factory] of [
  ['exchange-feed package client', createServiceFeedClient],
  ['deployed Next.js browser asset', createDeployedWebFeedClient],
]) {
  test(label + ': short-lived socket opens do not reset exponential reconnect delay', () => {
    const h = harness(factory);
    const client = h.create();
    h.sockets[0].open();
    h.sockets[0].drop();
    assert.equal(h.sockets.length, 1);
    h.advance(749);
    assert.equal(h.sockets.length, 1);
    h.advance(1);
    assert.equal(h.sockets.length, 2);

    h.sockets[1].open();
    h.sockets[1].drop();
    h.advance(1499);
    assert.equal(h.sockets.length, 2);
    h.advance(1);
    assert.equal(h.sockets.length, 3);
    client.close();
  });

  test(label + ': retry counter resets only after sustained connection with valid feed data', () => {
    const h = harness(factory);
    const client = h.create();
    h.sockets[0].open();
    h.sockets[0].message(validSnapshot);
    h.advance(30000);
    h.sockets[0].drop();
    h.advance(749);
    assert.equal(h.sockets.length, 1);
    h.advance(1);
    assert.equal(h.sockets.length, 2);
    h.sockets[1].open();
    h.sockets[1].drop();
    h.advance(1499);
    assert.equal(h.sockets.length, 2);
    h.advance(1);
    assert.equal(h.sockets.length, 3);
    client.close();
  });

  test(label + ': explicit close cancels pending reconnect', () => {
    const h = harness(factory);
    const client = h.create();
    h.sockets[0].open();
    h.sockets[0].drop();
    client.close();
    h.advance(60000);
    assert.equal(h.sockets.length, 1);
  });

  test(label + ': repeated close notifications cannot schedule duplicate reconnects', () => {
    const h = harness(factory);
    const client = h.create();
    h.sockets[0].open();
    h.sockets[0].drop();
    h.sockets[0].onclose();
    h.advance(750);
    assert.equal(h.sockets.length, 2);
    client.close();
  });
}
