'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createLifecycle } = require('./lifecycle');

test('stop closes tracked open and connecting sockets', () => {
  const lifecycle = createLifecycle();
  const closed = [];
  const open = { readyState: 1, close: (...args) => closed.push(['open', ...args]) };
  const connecting = { readyState: 0, close: (...args) => closed.push(['connecting', ...args]) };
  lifecycle.trackSocket(open);
  lifecycle.trackSocket(connecting);

  assert.equal(lifecycle.stop(), true);
  assert.equal(lifecycle.stopped, true);
  assert.equal(closed.length, 2);
  assert.equal(closed[0][1], 1001);
  assert.equal(closed[1][1], 1001);
  assert.equal(lifecycle.socketCount, 0);
});

test('stop clears tracked timeout and interval handles', () => {
  const lifecycle = createLifecycle();
  const cleared = [];
  const timeout = {};
  const interval = {};
  lifecycle.trackTimer(timeout, (timer) => cleared.push(['timeout', timer]));
  lifecycle.trackTimer(interval, (timer) => cleared.push(['interval', timer]));

  lifecycle.stop();

  assert.deepEqual(cleared, [['timeout', timeout], ['interval', interval]]);
  assert.equal(lifecycle.timerCount, 0);
});

test('stop is idempotent and resources registered afterwards are immediately stopped', () => {
  const lifecycle = createLifecycle();
  assert.equal(lifecycle.stop(), true);
  assert.equal(lifecycle.stop(), false);

  let cleared = false;
  lifecycle.trackTimer({}, () => { cleared = true; });
  let terminated = false;
  lifecycle.trackSocket({ terminate: () => { terminated = true; } });

  assert.equal(cleared, true);
  assert.equal(terminated, true);
});

test('stop aborts registered provider requests', () => {
  const lifecycle = createLifecycle();
  const controller = new AbortController();
  lifecycle.trackAbortController(controller);
  assert.equal(controller.signal.aborted, false);
  lifecycle.stop();
  assert.equal(controller.signal.aborted, true);
});
