import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrationApiKey, revokeIntegrationApiKey } from '../dist/key-lifecycle.js';

function fakePersistence({ tenantStatus = 'active', revokeResult = true } = {}) {
  const state = { key: null, audits: [], transactions: 0 };
  const tx = {
    tenants: {
      async findById(id) { return id === 'tenant_1' ? { id, status: tenantStatus, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } : null; },
      async create(record) { return record; },
      async updateStatus() {},
    },
    apiKeys: {
      async findByPrefix() { return state.key; },
      async create(record) { state.key = record; return { ...record, lastUsedAt: null, revokedAt: null }; },
      async revoke(tenantId, keyId, revokedAt) { if (!revokeResult || tenantId !== 'tenant_1' || state.key?.id !== keyId) return false; state.key = { ...state.key, status: 'revoked', revokedAt }; return true; },
      async touchLastUsed() {},
    },
    entitlements: { async findForProduct() { return null; }, async create(record) { return record; }, async updateStatus() { return false; } },
    verifications: { async create(record) { return record; }, async findById() { return null; }, async findByExternalReference() { return null; } },
    idempotency: { async find() { return null; }, async create(record) { return record; } },
    audit: { async append(event) { state.audits.push(event); } },
    providerExecutions: { async create() {}, async findForVerification() { return []; } },
    outbox: { async append() {} },
  };
  return {
    state,
    async withTransaction(work) { state.transactions += 1; return work(tx); },
  };
}

const admin = { tenantId: 'tenant_1', actorId: 'admin_1', requestId: 'req_1' };
const NOW = new Date('2026-11-28T12:00:00.000Z');

test('API-key creation stores only verifier and atomically audits creation', async () => {
  const persistence = fakePersistence();
  const created = await createIntegrationApiKey(persistence, admin, { scopes: ['kyc:submit'], expiresAt: '2027-01-01T00:00:00.000Z' }, NOW);
  assert.match(created.plaintext, /^vfy_live_/);
  assert.equal(persistence.state.key.verifier.length, 64);
  assert.equal(JSON.stringify(persistence.state.key).includes(created.plaintext), false);
  assert.equal(persistence.state.audits.length, 1);
  assert.equal(persistence.state.audits[0].action, 'integration_api_key.created');
  assert.equal(persistence.state.transactions, 1);
});

test('API-key creation fails closed for inactive tenants and invalid scopes', async () => {
  await assert.rejects(() => createIntegrationApiKey(fakePersistence({ tenantStatus: 'suspended' }), admin, { scopes: ['kyc:submit'], expiresAt: null }, NOW));
  await assert.rejects(() => createIntegrationApiKey(fakePersistence(), admin, { scopes: ['*'], expiresAt: null }, NOW));
  await assert.rejects(() => createIntegrationApiKey(fakePersistence(), admin, { scopes: ['kyc:submit', 'kyc:submit'], expiresAt: null }, NOW));
});

test('key revocation and audit event occur in the same transaction', async () => {
  const persistence = fakePersistence();
  const created = await createIntegrationApiKey(persistence, admin, { scopes: ['kyc:submit'], expiresAt: null }, NOW);
  const revoked = await revokeIntegrationApiKey(persistence, admin, created.id, NOW);
  assert.equal(revoked, true);
  assert.equal(persistence.state.key.status, 'revoked');
  assert.equal(persistence.state.audits.at(-1).action, 'integration_api_key.revoked');
  assert.equal(persistence.state.transactions, 2);
});

test('missing key revocation does not create a misleading audit event', async () => {
  const persistence = fakePersistence();
  assert.equal(await revokeIntegrationApiKey(persistence, admin, 'missing', NOW), false);
  assert.equal(persistence.state.audits.length, 0);
});
