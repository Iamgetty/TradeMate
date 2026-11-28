import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeTenantAdmin,
  requireTenantAdminRole,
  TenantAdminAuthorizationError,
} from '../dist/tenant-admin-authorization.js';

const identity = { issuer: 'https://identity.example.test/', subject: 'opaque-subject-123' };
const tenant = { id: 'tenant-1', status: 'active', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const membership = {
  id: 'membership-1',
  tenantId: 'tenant-1',
  identityIssuer: identity.issuer,
  identitySubject: identity.subject,
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function repositories(overrides = {}) {
  return {
    tenants: {
      async findById(id) { return id === tenant.id ? (overrides.tenant ?? tenant) : null; },
    },
    tenantAdmins: {
      async findByIdentity(tenantId, issuer, subject) {
        if (tenantId !== membership.tenantId || issuer !== identity.issuer || subject !== identity.subject) return null;
        return overrides.membership ?? membership;
      },
    },
  };
}

test('resolves an active tenant admin from validated issuer and subject claims', async () => {
  const context = await authorizeTenantAdmin(identity, tenant.id, 'request-1', repositories());
  assert.equal(context.tenantId, tenant.id);
  assert.equal(context.actorId, membership.id);
  assert.equal(context.role, 'admin');
  assert.equal(context.requestId, 'request-1');
});

test('inactive tenant, inactive membership and cross-tenant membership fail closed', async () => {
  await assert.rejects(() => authorizeTenantAdmin(identity, tenant.id, 'request-1', repositories({ tenant: { ...tenant, status: 'suspended' } })), TenantAdminAuthorizationError);
  await assert.rejects(() => authorizeTenantAdmin(identity, tenant.id, 'request-1', repositories({ membership: { ...membership, status: 'suspended' } })), TenantAdminAuthorizationError);
  await assert.rejects(() => authorizeTenantAdmin(identity, tenant.id, 'request-1', repositories({ membership: { ...membership, tenantId: 'tenant-other' } })), TenantAdminAuthorizationError);
  await assert.rejects(() => authorizeTenantAdmin(identity, 'tenant-other', 'request-1', repositories()), TenantAdminAuthorizationError);
});

test('tenant admins may perform admin operations but only owners pass owner checks', async () => {
  const adminContext = await authorizeTenantAdmin(identity, tenant.id, 'request-1', repositories());
  assert.doesNotThrow(() => requireTenantAdminRole(adminContext, 'admin'));
  assert.throws(() => requireTenantAdminRole(adminContext, 'owner'), TenantAdminAuthorizationError);
  const ownerContext = { ...adminContext, role: 'owner' };
  assert.doesNotThrow(() => requireTenantAdminRole(ownerContext, 'owner'));
});

test('missing or malformed trusted identity context fails closed', async () => {
  await assert.rejects(() => authorizeTenantAdmin({ issuer: '', subject: 'x' }, tenant.id, 'request-1', repositories()), TenantAdminAuthorizationError);
  await assert.rejects(() => authorizeTenantAdmin(identity, tenant.id, '', repositories()), TenantAdminAuthorizationError);
});
