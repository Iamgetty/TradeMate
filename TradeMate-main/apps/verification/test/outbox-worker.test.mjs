import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchOutboxBatch, outboxRetryDelayMs, OutboxDispatchError } from '../dist/outbox-worker.js';

function makePersistence(events) {
  const state = structuredClone(events);
  const tx = {
    outbox: {
      append: async (event) => {
        state.push({ ...event, status: 'pending', attempts: 0, availableAt: event.createdAt, leaseToken: null, leaseUntil: null, lastErrorCode: null, deliveredAt: null, updatedAt: event.createdAt });
      },
      claimDue: async ({ now, leaseUntil, limit }) => {
        const claimed = [];
        for (const event of state) {
          const due = event.status === 'pending' && event.availableAt <= now;
          const expired = event.status === 'processing' && event.leaseUntil <= now;
          if ((due || expired) && claimed.length < limit) {
            event.status = 'processing';
            event.attempts += 1;
            event.leaseToken = 'lease-' + event.id + '-' + event.attempts;
            event.leaseUntil = leaseUntil;
            event.updatedAt = now;
            claimed.push(structuredClone(event));
          }
        }
        return claimed;
      },
      markDelivered: async (id, token, deliveredAt) => {
        const event = state.find((item) => item.id === id);
        if (!event || event.status !== 'processing' || event.leaseToken !== token) return false;
        event.status = 'delivered';
        event.deliveredAt = deliveredAt;
        event.leaseToken = null;
        event.leaseUntil = null;
        return true;
      },
      reschedule: async ({ eventId, leaseToken, availableAt, updatedAt, errorCode, deadLetter }) => {
        const event = state.find((item) => item.id === eventId);
        if (!event || event.status !== 'processing' || event.leaseToken !== leaseToken) return false;
        event.status = deadLetter ? 'dead_letter' : 'pending';
        event.availableAt = availableAt;
        event.updatedAt = updatedAt;
        event.lastErrorCode = errorCode;
        event.leaseToken = null;
        event.leaseUntil = null;
        return true;
      },
    },
  };
  return {
    state,
    persistence: { withTransaction: async (work) => work(tx) },
  };
}

const event = {
  id: 'event-1', tenantId: 'tenant-1', eventType: 'verification.requested',
  aggregateId: 'verification-1', payload: { verificationId: 'verification-1' },
  createdAt: '2026-11-28T12:00:00.000Z', status: 'pending', attempts: 0,
  availableAt: '2026-11-28T12:00:00.000Z', leaseToken: null, leaseUntil: null,
  lastErrorCode: null, deliveredAt: null, updatedAt: '2026-11-28T12:00:00.000Z',
};
const now = new Date('2026-11-28T12:01:00.000Z');

test('claims and dispatches events outside the transaction, then acknowledges them', async () => {
  const { persistence, state } = makePersistence([event]);
  let calls = 0;
  const summary = await dispatchOutboxBatch(persistence, {
    workerId: 'worker-a',
    now,
    handlers: { 'verification.requested': { handle: async (claimed) => { calls += 1; assert.equal(claimed.status, 'processing'); } } },
  });
  assert.equal(calls, 1);
  assert.deepEqual(summary, { claimed: 1, delivered: 1, rescheduled: 0, deadLettered: 0, leaseLost: 0 });
  assert.equal(state[0].status, 'delivered');
});

test('retries failures with safe error codes and capped exponential delay', async () => {
  const { persistence, state } = makePersistence([event]);
  const summary = await dispatchOutboxBatch(persistence, {
    workerId: 'worker-a', now,
    handlers: { 'verification.requested': { handle: async () => { throw new OutboxDispatchError('PROVIDER_TIMEOUT'); } } },
  });
  assert.equal(summary.rescheduled, 1);
  assert.equal(state[0].status, 'pending');
  assert.equal(state[0].lastErrorCode, 'PROVIDER_TIMEOUT');
  assert.equal(state[0].availableAt, new Date(now.getTime() + 1_000).toISOString());
  assert.equal(outboxRetryDelayMs(1), 1_000);
  assert.equal(outboxRetryDelayMs(8), 128_000);
  assert.equal(outboxRetryDelayMs(20), 900_000);
});

test('dead-letters after the configured attempt limit', async () => {
  const retrying = { ...event, attempts: 7 };
  const { persistence, state } = makePersistence([retrying]);
  const summary = await dispatchOutboxBatch(persistence, {
    workerId: 'worker-a', now, maxAttempts: 8,
    handlers: { 'verification.requested': { handle: async () => { throw new Error('sensitive provider payload'); } } },
  });
  assert.equal(summary.deadLettered, 1);
  assert.equal(state[0].status, 'dead_letter');
  assert.equal(state[0].lastErrorCode, 'DISPATCH_FAILED');
  assert.equal(state[0].lastErrorCode.includes('sensitive'), false);
});

test('missing handler is safely retried rather than silently discarded', async () => {
  const { persistence, state } = makePersistence([event]);
  const summary = await dispatchOutboxBatch(persistence, { workerId: 'worker-a', now, handlers: {} });
  assert.equal(summary.rescheduled, 1);
  assert.equal(state[0].lastErrorCode, 'HANDLER_UNAVAILABLE');
});

test('rejects invalid worker settings', async () => {
  const { persistence } = makePersistence([]);
  await assert.rejects(dispatchOutboxBatch(persistence, { workerId: '', now, handlers: {} }));
});
