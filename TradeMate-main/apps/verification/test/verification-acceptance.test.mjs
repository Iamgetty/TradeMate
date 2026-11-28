import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptVerificationRequest, VerificationAcceptanceError } from '../dist/verification-acceptance.js';

const now = new Date('2026-11-28T12:00:00.000Z');
const input = {
  authorization: {
    tenantId: 'tenant-1',
    apiKeyId: 'key-1',
    productId: 'kyc',
    scopes: ['verification:create'],
  },
  requestId: 'request-1',
  idempotencyKey: 'client-key-1234567890',
  policyVersion: 'ng-kyc-v1',
  request: {
    kind: 'government_id',
    countryCode: 'NG',
    subject: { reference: 'customer-ref-1', type: 'individual' },
    consent: {
      captured: true,
      capturedAt: '2026-11-28T11:59:00.000Z',
      noticeVersion: '2026-01',
    },
  },
};

function makePersistence({ tenantStatus = 'active', entitlementStatus = 'active' } = {}) {
  const state = {
    idempotency: new Map(),
    verifications: new Map(),
    audits: [],
    outbox: [],
  };
  const tx = {
    tenants: { findById: async () => ({ id: 'tenant-1', status: tenantStatus }) },
    entitlements: {
      findForProduct: async () => ({
        tenantId: 'tenant-1', productId: 'kyc', status: entitlementStatus,
        startsAt: '2026-01-01T00:00:00.000Z', expiresAt: null,
      }),
    },
    idempotency: {
      find: async (tenantId, operation, keyHash) => state.idempotency.get(tenantId + operation + keyHash) ?? null,
      create: async (record) => {
        const key = record.tenantId + record.operation + record.keyHash;
        if (state.idempotency.has(key)) throw new Error('duplicate idempotency key');
        state.idempotency.set(key, record);
        return record;
      },
    },
    verifications: {
      create: async (record) => {
        const saved = { ...record, outcome: null, updatedAt: record.createdAt, completedAt: null };
        state.verifications.set(record.id, saved);
        return saved;
      },
      findById: async (tenantId, id) => {
        const record = state.verifications.get(id);
        return record?.tenantId === tenantId ? record : null;
      },
      findByExternalReference: async (tenantId, productId, reference) =>
        [...state.verifications.values()].find((v) => v.tenantId === tenantId && v.productId === productId && v.externalReference === reference) ?? null,
    },
    audit: { append: async (event) => { state.audits.push(event); } },
    outbox: { append: async (event) => { state.outbox.push(event); } },
  };
  return {
    state,
    persistence: {
      withTransaction: async (work) => {
        const snapshot = structuredClone(state);
        try { return await work(tx); }
        catch (error) {
          state.idempotency = snapshot.idempotency;
          state.verifications = snapshot.verifications;
          state.audits = snapshot.audits;
          state.outbox = snapshot.outbox;
          throw error;
        }
      },
    },
  };
}

test('accepts atomically and writes one idempotency record, audit event and outbox event', async () => {
  const { persistence, state } = makePersistence();
  const result = await acceptVerificationRequest(persistence, input, now);
  assert.equal(result.replayed, false);
  assert.equal(result.verification.status, 'accepted');
  assert.equal(state.idempotency.size, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.outbox.length, 1);
  assert.deepEqual(state.outbox[0].payload, { verificationId: result.verification.id });
});

test('identical retry returns original resource without duplicate side effects', async () => {
  const { persistence, state } = makePersistence();
  const first = await acceptVerificationRequest(persistence, input, now);
  const retry = await acceptVerificationRequest(persistence, input, now);
  assert.equal(retry.replayed, true);
  assert.equal(retry.verification.id, first.verification.id);
  assert.equal(state.idempotency.size, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.outbox.length, 1);
});

test('rejects reuse of an idempotency key with changed request parameters', async () => {
  const { persistence } = makePersistence();
  await acceptVerificationRequest(persistence, input, now);
  const changed = { ...input, request: { ...input.request, countryCode: 'GH' } };
  await assert.rejects(
    acceptVerificationRequest(persistence, changed, now),
    (error) => error instanceof VerificationAcceptanceError && error.code === 'idempotency_conflict',
  );
});

test('fails closed when tenant or product entitlement is inactive', async () => {
  for (const options of [{ tenantStatus: 'suspended' }, { entitlementStatus: 'suspended' }]) {
    const { persistence, state } = makePersistence(options);
    await assert.rejects(
      acceptVerificationRequest(persistence, input, now),
      (error) => error instanceof VerificationAcceptanceError && error.code === 'not_authorized',
    );
    assert.equal(state.verifications.size, 0);
    assert.equal(state.outbox.length, 0);
  }
});

test('requires create scope and explicit captured consent', async () => {
  const { persistence } = makePersistence();
  await assert.rejects(
    acceptVerificationRequest(persistence, { ...input, authorization: { ...input.authorization, scopes: [] } }, now),
    (error) => error instanceof VerificationAcceptanceError && error.code === 'not_authorized',
  );
  await assert.rejects(
    acceptVerificationRequest(persistence, { ...input, request: { ...input.request, consent: { ...input.request.consent, captured: false } } }, now),
    (error) => error instanceof VerificationAcceptanceError && error.code === 'invalid_request',
  );
});

test('rejects duplicate external references submitted with a different idempotency key', async () => {
  const { persistence } = makePersistence();
  await acceptVerificationRequest(persistence, input, now);
  await assert.rejects(
    acceptVerificationRequest(persistence, { ...input, idempotencyKey: 'different-client-key-12345' }, now),
    (error) => error instanceof VerificationAcceptanceError && error.code === 'duplicate_reference',
  );
});
