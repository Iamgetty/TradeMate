import test from 'node:test';
import assert from 'node:assert/strict';
import { issueApiKey } from '../dist/api-keys.js';
import { authorizeProductRequest, AuthorizationError } from '../dist/authorization.js';

function repositoriesFor(issued, overrides = {}) {
  const key = { id: 'key_1', tenantId: 'tenant_1', prefix: issued.prefix, verifier: issued.verifier, status: 'active', scopes: ['verification:read', 'kyc:submit'] };
  const tenant = { id: 'tenant_1', status: 'active' };
  const entitlement = { tenantId: 'tenant_1', productId: 'kyc', status: 'active' };
  return {
    async findApiKeyByPrefix(prefix) { return prefix === key.prefix ? (overrides.key ?? key) : null; },
    async findTenantById(id) { return id === tenant.id ? (overrides.tenant ?? tenant) : null; },
    async findProductEntitlement(tenantId, productId) {
      return tenantId === entitlement.tenantId && productId === entitlement.productId ? (overrides.entitlement ?? entitlement) : null;
    },
  };
}

test('active key, tenant and product entitlement authorize a tenant context', async () => {
  const issued = issueApiKey();
  const context = await authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued));
  assert.equal(context.tenantId, 'tenant_1');
  assert.equal(context.productId, 'kyc');
  assert.deepEqual(context.scopes, ['verification:read', 'kyc:submit']);
});

test('invalid keys and missing products fail with the same generic authorization error', async () => {
  const issued = issueApiKey();
  await assert.rejects(() => authorizeProductRequest('invalid', 'kyc', repositoriesFor(issued)), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyb', repositoriesFor(issued)), AuthorizationError);
});

test('revoked keys, suspended tenants and inactive entitlements are denied', async () => {
  const issued = issueApiKey();
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { key: { id:'key_1', tenantId:'tenant_1', prefix:issued.prefix, verifier:issued.verifier, status:'revoked', scopes:[] } })), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { tenant: { id:'tenant_1', status:'suspended' } })), AuthorizationError);
  await assert.rejects(() => authorizeProductRequest(issued.plaintext, 'kyc', repositoriesFor(issued, { entitlement: { tenantId:'tenant_1', productId:'kyc', status:'suspended' } })), AuthorizationError);
});
