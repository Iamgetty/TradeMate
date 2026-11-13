'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createReconnectPolicy } = require('./reconnect-policy');

test('reconnect delay grows exponentially with equal jitter', () => {
  const policy = createReconnectPolicy({ random: () => 0.5 });
  assert.deepEqual(
    Array.from({ length: 6 }, () => policy.nextDelay()),
    [750, 1500, 3000, 6000, 12000, 24000],
  );
});

test('reconnect delay is capped at the configured maximum', () => {
  const policy = createReconnectPolicy({ random: () => 1, maxDelayMs: 5000 });
  assert.deepEqual(
    Array.from({ length: 6 }, () => policy.nextDelay()),
    [1000, 2000, 4000, 5000, 5000, 5000],
  );
});

test('retry budget resets only when the caller declares a stable connection', () => {
  const policy = createReconnectPolicy({ random: () => 0.5 });
  policy.nextDelay();
  policy.nextDelay();
  assert.equal(policy.attempt, 2);
  policy.reset();
  assert.equal(policy.attempt, 0);
  assert.equal(policy.nextDelay(), 750);
});

test('jitter source is bounded before calculating a delay', () => {
  const low = createReconnectPolicy({ random: () => -1 });
  const high = createReconnectPolicy({ random: () => 2 });
  assert.equal(low.nextDelay(), 500);
  assert.equal(high.nextDelay(), 1000);
});
