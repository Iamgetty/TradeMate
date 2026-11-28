import { randomUUID } from 'node:crypto';
import { issueApiKey } from './api-keys.js';
import type { VeriFirePersistence } from './repository-contracts.js';

export interface TenantAdminContext {
  /** Resolved by the trusted admin-authentication layer, never request JSON. */
  tenantId: string;
  actorId: string;
  requestId: string;
}

export interface CreateIntegrationKeyInput {
  scopes: readonly string[];
  expiresAt: string | null;
}

export interface CreatedIntegrationKey {
  id: string;
  plaintext: string;
  prefix: string;
  expiresAt: string | null;
}

/**
 * Create a tenant API key and audit event atomically.
 * Caller must authenticate/authorize the tenant administrator before calling.
 */
export async function createIntegrationApiKey(
  persistence: VeriFirePersistence,
  admin: TenantAdminContext,
  input: CreateIntegrationKeyInput,
  now: Date = new Date(),
): Promise<CreatedIntegrationKey> {
  if (!admin.tenantId || !admin.actorId || !admin.requestId || !Number.isFinite(now.getTime())) {
    throw new Error('A valid authenticated tenant administrator context is required.');
  }
  if (!Array.isArray(input.scopes) || input.scopes.length === 0 || input.scopes.length > 32 ||
      input.scopes.some((scope) => typeof scope !== 'string' || !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(scope)) ||
      new Set(input.scopes).size !== input.scopes.length) {
    throw new Error('At least one unique, valid API-key scope is required.');
  }
  if (input.expiresAt !== null && (!Number.isFinite(Date.parse(input.expiresAt)) || Date.parse(input.expiresAt) <= now.getTime())) {
    throw new Error('API-key expiry must be a valid future timestamp.');
  }

  const issued = issueApiKey();
  const id = randomUUID();
  const createdAt = now.toISOString();
  await persistence.withTransaction(async (tx) => {
    const tenant = await tx.tenants.findById(admin.tenantId);
    if (!tenant || tenant.status !== 'active') throw new Error('Tenant is not eligible for API-key creation.');
    await tx.apiKeys.create({
      id,
      tenantId: admin.tenantId,
      prefix: issued.prefix,
      verifier: issued.verifier,
      status: 'active',
      scopes: [...input.scopes],
      expiresAt: input.expiresAt,
      createdAt,
    });
    await tx.audit.append({
      id: randomUUID(),
      tenantId: admin.tenantId,
      actorType: 'tenant_admin',
      actorId: admin.actorId,
      action: 'integration_api_key.created',
      targetType: 'integration_api_key',
      targetId: id,
      occurredAt: createdAt,
      requestId: admin.requestId,
      metadata: { scopes: input.scopes.join(','), expiresAt: input.expiresAt },
    });
  });
  return { id, plaintext: issued.plaintext, prefix: issued.prefix, expiresAt: input.expiresAt };
}

/** Revoke a key and append its audit event in the same transaction. */
export async function revokeIntegrationApiKey(
  persistence: VeriFirePersistence,
  admin: TenantAdminContext,
  keyId: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!admin.tenantId || !admin.actorId || !admin.requestId || !keyId || !Number.isFinite(now.getTime())) {
    throw new Error('A valid authenticated tenant administrator context is required.');
  }
  return persistence.withTransaction(async (tx) => {
    const revoked = await tx.apiKeys.revoke(admin.tenantId, keyId, now.toISOString());
    if (!revoked) return false;
    await tx.audit.append({
      id: randomUUID(),
      tenantId: admin.tenantId,
      actorType: 'tenant_admin',
      actorId: admin.actorId,
      action: 'integration_api_key.revoked',
      targetType: 'integration_api_key',
      targetId: keyId,
      occurredAt: now.toISOString(),
      requestId: admin.requestId,
      metadata: {},
    });
    return true;
  });
}
