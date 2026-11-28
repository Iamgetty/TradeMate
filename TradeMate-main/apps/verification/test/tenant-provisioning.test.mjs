import test from 'node:test';
import assert from 'node:assert/strict';
import { provisionTenant, TenantProvisioningError } from '../dist/tenant-provisioning.js';

const NOW = new Date('2026-11-28T12:00:00.000Z');
const admin = { actorId: 'platform-operator-1', requestId: 'request-1' };
const input = {
  requestKey: 'provision-request-0001',
  owner: { issuer: 'https://identity.example.test/', subject: 'opaque-subject-123' },
  products: [
    { productId: 'kyc', startsAt: '2026-11-28T12:00:00.000Z', expiresAt: null },
    { productId: 'kyb', startsAt: '2026-11-28T12:00:00.000Z', expiresAt: '2027-11-28T12:00:00.000Z' },
  ],
};

function fakePersistence() {
  const state = {
    tenants: new Map(),
    memberships: new Map(),
    entitlements: [],
    provisioning: new Map(),
    audits: [],
    transactions: 0,
  };
  const tx = {
    tenants: {
      async findById(id) { return state.tenants.get(id) ?? null; },
      async create(record) { state.tenants.set(record.id, record); return record; },
      async updateStatus() {},
    },
    tenantAdmins: {
      async findByIdentity(issuer, subject) {
        return [...state.memberships.values()].find((item) => item.identityIssuer === issuer && item.identitySubject === subject) ?? null;
      },
      async findById(tenantId, id) {
        const item = state.memberships.get(id);
        return item?.tenantId === tenantId ? item : null;
      },
      async create(record) { state.memberships.set(record.id, record); return record; },
      async updateStatus() { return false; },
    },
    platformProvisioning: {
      async findByRequestKeyHash(key) { return state.provisioning.get(key) ?? null; },
      async create(record) { state.provisioning.set(record.requestKeyHash, record); return record; },
    },
    apiKeys: {
      async findByPrefix() { return null; },
      async create(record) { return record; },
      async revoke() { return false; },
      async touchLastUsed() {},
    },
    entitlements: {
      async findForProduct() { return null; },
      async create(record) { state.entitlements.push(record); return record; },
      async updateStatus() { return false; },
    },
    verifications: {
      async create(record) { return record; },
      async findById() { return null; },
      async findByExternalReference() { return null; },
    },
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

test('provisions tenant, owner membership, entitlements and audit in one transaction', async () => {
  const persistence = fakePersistence();
  const result = await provisionTenant(persistence, admin, input, NOW);
  assert.equal(result.replayed, false);
  assert.equal(persistence.state.tenants.size, 1);
  assert.equal(persistence.state.memberships.size, 1);
  assert.equal(persistence.state.entitlements.length, 2);
  assert.equal(persistence.state.memberships.get(result.ownerMembershipId).role, 'owner');
  assert.deepEqual(result.productIds, ['kyb', 'kyc']);
  assert.equal(persistence.state.audits[0].action, 'tenant.provisioned');
  assert.equal(persistence.state.transactions, 1);
});

test('same provisioning request key and parameters return the original tenant', async () => {
  const persistence = fakePersistence();
  const first = await provisionTenant(persistence, admin, input, NOW);
  const second = await provisionTenant(persistence, { ...admin, requestId: 'request-retry' }, input, NOW);
  assert.equal(second.replayed, true);
  assert.equal(second.tenantId, first.tenantId);
  assert.equal(second.ownerMembershipId, first.ownerMembershipId);
  assert.equal(persistence.state.tenants.size, 1);
  assert.equal(persistence.state.entitlements.length, 2);
  assert.equal(persistence.state.audits.length, 1);
});

test('reusing a provisioning request key with changed parameters fails closed', async () => {
  const persistence = fakePersistence();
  await provisionTenant(persistence, admin, input, NOW);
  const changed = { ...input, products: [{ productId: 'kyc', expiresAt: null }] };
  await assert.rejects(() => provisionTenant(persistence, admin, changed, NOW), TenantProvisioningError);
  assert.equal(persistence.state.tenants.size, 1);
});

test('an external identity already assigned to a tenant cannot be provisioned again', async () => {
  const persistence = fakePersistence();
  await provisionTenant(persistence, admin, input, NOW);
  const second = { ...input, requestKey: 'provision-request-0002' };
  await assert.rejects(() => provisionTenant(persistence, admin, second, NOW), TenantProvisioningError);
  assert.equal(persistence.state.tenants.size, 1);
});

test('invalid issuer, duplicate products and invalid entitlement windows are rejected before persistence', async () => {
  const persistence = fakePersistence();
  await assert.rejects(() => provisionTenant(persistence, admin, { ...input, owner: { ...input.owner, issuer: 'http://identity.example.test' } }, NOW), TenantProvisioningError);
  await assert.rejects(() => provisionTenant(persistence, admin, { ...input, products: [{ productId: 'kyc', expiresAt: null }, { productId: 'kyc', expiresAt: null }] }, NOW), TenantProvisioningError);
  await assert.rejects(() => provisionTenant(persistence, admin, { ...input, products: [{ productId: 'kyc', startsAt: '2026-11-28T13:00:00.000Z', expiresAt: null }] }, NOW), TenantProvisioningError);
  assert.equal(persistence.state.transactions, 0);
});
