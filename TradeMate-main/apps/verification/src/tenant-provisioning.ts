import { createHash, randomUUID } from 'node:crypto';
import type { VeriFirePersistence } from './repository-contracts.js';

export interface PlatformAdminContext {
  /** Supplied only by a future trusted platform-admin authentication layer. */
  actorId: string;
  requestId: string;
}

export interface TenantOwnerIdentity {
  /** OIDC issuer URL from a validated identity token; never request-body authority. */
  issuer: string;
  /** OIDC subject from a validated identity token; opaque and stable per issuer. */
  subject: string;
}

export interface InitialProductEntitlement {
  productId: string;
  startsAt: string;
  expiresAt: string | null;
}

export interface ProvisionTenantInput {
  /** Client-generated stable retry key; do not use an email or personal identifier. */
  requestKey: string;
  owner: TenantOwnerIdentity;
  products: readonly InitialProductEntitlement[];
}

export interface ProvisionedTenant {
  tenantId: string;
  ownerMembershipId: string;
  productIds: readonly string[];
  replayed: boolean;
}

export class TenantProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantProvisioningError';
  }
}

const PRODUCT_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

function isValidIssuer(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' &&
      url.search === '' && url.hash === '' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function validateInput(admin: PlatformAdminContext, input: ProvisionTenantInput, now: Date): {
  requestKeyHash: string;
  requestFingerprint: string;
  products: Array<{ productId: string; startsAt: string; expiresAt: string | null }>;
} {
  if (!admin.actorId || !admin.requestId || !Number.isFinite(now.getTime())) {
    throw new TenantProvisioningError('A trusted platform administrator context is required.');
  }
  if (typeof input.requestKey !== 'string' || input.requestKey.length < 16 || input.requestKey.length > 128 ||
      !/^[A-Za-z0-9._~-]+$/.test(input.requestKey)) {
    throw new TenantProvisioningError('A valid provisioning request key is required.');
  }
  if (!isValidIssuer(input.owner.issuer) || typeof input.owner.subject !== 'string' ||
      input.owner.subject.length < 1 || input.owner.subject.length > 255 ||
      /[\u0000-\u001f\u007f]/.test(input.owner.subject)) {
    throw new TenantProvisioningError('A valid external owner identity is required.');
  }
  if (!Array.isArray(input.products) || input.products.length < 1 || input.products.length > 32) {
    throw new TenantProvisioningError('At least one initial product entitlement is required.');
  }

  const products = input.products.map((product) => {
    if (!PRODUCT_ID_PATTERN.test(product.productId)) {
      throw new TenantProvisioningError('An initial product identifier is invalid.');
    }
    const startsAt = product.startsAt;
    const startTime = Date.parse(startsAt);
    const expiryTime = product.expiresAt === null ? Number.POSITIVE_INFINITY : Date.parse(product.expiresAt);
    if (!Number.isFinite(startTime) || (product.expiresAt !== null && !Number.isFinite(expiryTime)) ||
        startTime < now.getTime() - 60_000 || expiryTime <= startTime) {
      throw new TenantProvisioningError('Entitlement validity windows must be valid and non-expired.');
    }
    return { productId: product.productId, startsAt: new Date(startTime).toISOString(), expiresAt: product.expiresAt };
  });
  const ids = products.map((product) => product.productId);
  if (new Set(ids).size !== ids.length) {
    throw new TenantProvisioningError('Initial product entitlements must be unique.');
  }
  products.sort((a, b) => a.productId.localeCompare(b.productId));

  const requestFingerprint = hash(JSON.stringify({
    issuer: input.owner.issuer,
    subject: input.owner.subject,
    products,
  }));
  return { requestKeyHash: hash(input.requestKey), requestFingerprint, products };
}

/**
 * Provision a tenant, its initial owner membership and approved product
 * entitlements in one persistence transaction. The caller must authenticate
 * a platform operator and validate the external identity claims before entry.
 */
export async function provisionTenant(
  persistence: VeriFirePersistence,
  admin: PlatformAdminContext,
  input: ProvisionTenantInput,
  now: Date = new Date(),
): Promise<ProvisionedTenant> {
  const validated = validateInput(admin, input, now);
  const createdAt = now.toISOString();

  return persistence.withTransaction(async (tx) => {
    const previous = await tx.platformProvisioning.findByRequestKeyHash(validated.requestKeyHash);
    if (previous) {
      if (previous.requestFingerprint !== validated.requestFingerprint) {
        throw new TenantProvisioningError('The provisioning request key was already used with different parameters.');
      }
      const tenant = await tx.tenants.findById(previous.tenantId);
      const owner = await tx.tenantAdmins.findById(previous.tenantId, previous.ownerMembershipId);
      if (!tenant || !owner) throw new TenantProvisioningError('The previous provisioning record is inconsistent.');
      return {
        tenantId: previous.tenantId,
        ownerMembershipId: previous.ownerMembershipId,
        productIds: previous.productIds,
        replayed: true,
      };
    }

    const tenantId = randomUUID();
    const ownerMembershipId = randomUUID();
    await tx.tenants.create({
      id: tenantId,
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    });
    await tx.tenantAdmins.create({
      id: ownerMembershipId,
      tenantId,
      identityIssuer: input.owner.issuer,
      identitySubject: input.owner.subject,
      role: 'owner',
      status: 'active',
      createdAt,
      updatedAt: createdAt,
    });

    for (const product of validated.products) {
      await tx.entitlements.create({
        id: randomUUID(),
        tenantId,
        productId: product.productId,
        status: 'active',
        startsAt: product.startsAt,
        expiresAt: product.expiresAt,
        createdAt,
        updatedAt: createdAt,
      });
    }

    await tx.platformProvisioning.create({
      requestKeyHash: validated.requestKeyHash,
      requestFingerprint: validated.requestFingerprint,
      tenantId,
      ownerMembershipId,
      productIds: validated.products.map((product) => product.productId),
      createdAt,
    });
    await tx.audit.append({
      id: randomUUID(),
      tenantId,
      actorType: 'platform_admin',
      actorId: admin.actorId,
      action: 'tenant.provisioned',
      targetType: 'tenant',
      targetId: tenantId,
      occurredAt: createdAt,
      requestId: admin.requestId,
      metadata: {
        ownerMembershipId,
        initialProductCount: validated.products.length,
        productIds: validated.products.map((product) => product.productId).join(','),
      },
    });

    return {
      tenantId,
      ownerMembershipId,
      productIds: validated.products.map((product) => product.productId),
      replayed: false,
    };
  });
}
