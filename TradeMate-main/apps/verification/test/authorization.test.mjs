import test from 'node:test';
import assert from 'node:assert/strict';
import { issueApiKey } from '../dist/api-keys.js';
import { authorizeProductRequest, requireScope, AuthorizationError } from '../dist/authorization.js';

const NOW = new Date('2026-11-28T12:00:00.000Z');

function repositoriesFor(issued, overrides = {}) {
  const key = { id: 'key_1', tenantId: 'tenant_1', prefix: issued.prefix, verifier: issued.verifier, status: 'active', scopes: ['verification:read', 'kyc:submit'], expiresAt: null };
  const tenant = { id: 'tenant_1', status: 'active' };
  const entitlement = { tenantId: 'tenant_1', productId: 'kyc', status: 'active', startsAt: '2026-01-01T00:00:00.000Z', expiresAt: null };
  return {
    async findApiKeyByPrefix(prefix) { return prefix === key.prefix ? (overrides.key ?? key) : null; },
    async findTenantById(id) { return id === tenant.id ? (overrides.tenant ?? tenant) : null; },
    async findProductEntitlement(tenantId, productId) {
      return tenantId === entitlement.tenantId && productId === entitlement.productId ? (overrides.entitlement ?? entitlement) : null;
    },
  };
}

test('active key, tenant and in-window product entitlement authorize a tenant context', async () => {
  const issued = issueApiKey();
  const context = await authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued), NOW);
  assert.equal(context.tenantId, 'tenant_1');
  assert.equal(context.productId, 'kyc');
  assert.deepEqual(context.scopes, ['verification:read', 'kyc:submit']);
});

test('invalid keys and missing products fail with the same generic authorization error', async () => {
  const issued = issueApiKey();
  await assert.rejects(() => authorizeProductRequest('invalid', 'kyc', repositoriesFor(issued), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyb', repositoriesFor(issued), NOW), AuthorizationError);
});

test('revoked keys, suspended tenants and inactive entitlements are denied', async () => {
  const issued = issueApiKey();
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { key: { id:'key_1', tenantId:'tenant_1', prefix:issued.prefix, verifier:issued.verifier, status:'revoked', scopes:[], expiresAt:null } }), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { tenant: { id:'tenant_1', status:'suspended' } }), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { entitlement: { tenantId:'tenant_1', productId:'kyc', status:'suspended', startsAt:'2026-01-01T00:00:00.000Z', expiresAt:null } }), NOW), AuthorizationError);
});

test('expired API keys and entitlements are denied', async () => {
  const issued = issueApiKey();
  const expiredKey = { id:'key_1', tenantId:'tenant_1', prefix:issued.prefix, verifier:issued.verifier, status:'active', scopes:[], expiresAt:'2026-11-28T11:59:59.999Z' };
  const expiredEntitlement = { tenantId:'tenant_1', productId:'kyc', status:'active', startsAt:'2026-01-01T00:00:00.000Z', expiresAt:'2026-11-28T11:59:59.999Z' };
  const futureEntitlement = { tenantId:'tenant_1', productId:'kyc', status:'active', startsAt:'2026-11-28T12:00:00.001Z', expiresAt:null };
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { key: expiredKey }), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { entitlement: expiredEntitlement }), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { entitlement: futureEntitlement }), NOW), AuthorizationError);
});

test('malformed validity timestamps fail closed', async () => {
  const issued = issueApiKey();
  const invalidKey = { id:'key_1', tenantId:'tenant_1', prefix:issued.prefix, verifier:issued.verifier, status:'active', scopes:[], expiresAt:'not-a-date' };
  const invalidEntitlement = { tenantId:'tenant_1', productId:'kyc', status:'active', startsAt:'not-a-date', expiresAt:null };
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { key: invalidKey }), NOW), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { entitlement: invalidEntitlement }), NOW), AuthorizationError);
});

test('scope checks require an exact granted scope and fail closed', () => {
  const context = { tenantId: 'tenant_1', apiKeyId: 'key_1', productId: 'kyc', scopes: ['kyc:submit', 'verification:read'] };
  assert.doesNotThrow(() => requireScope(context, 'kyc:submit'));
  assert.throws(() => requireScope(context, 'kyb:submit'), AuthorizationError);
  assert.throws(() => requireScope(context, 'not a scope'), AuthorizationError);
});
