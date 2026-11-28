import { verifyApiKey } from './api-keys.js';

export type TenantStatus = 'active' | 'suspended' | 'closed';
export type ApiKeyStatus = 'active' | 'revoked';
export type EntitlementStatus = 'active' | 'suspended' | 'expired';

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  prefix: string;
  verifier: string;
  status: ApiKeyStatus;
  scopes: readonly string[];
}
export interface TenantRecord {
  id: string;
  status: TenantStatus;
}
export interface ProductEntitlement {
  tenantId: string;
  productId: string;
  status: EntitlementStatus;
}
export interface AuthorizationRepositories {
  findApiKeyByPrefix(prefix: string): Promise<ApiKeyRecord | null>;
  findTenantById(tenantId: string): Promise<TenantRecord | null>;
  findProductEntitlement(tenantId: string, productId: string): Promise<ProductEntitlement | null>;
}
export interface AuthorizedTenantContext {
  tenantId: string;
  apiKeyId: string;
  productId: string;
  scopes: readonly string[];
}

export class AuthorizationError extends Error {
  constructor() {
    // Keep failures indistinguishable to avoid disclosing key/tenant/entitlement state.
    super('The supplied credentials are not authorized for this product.');
    this.name = 'AuthorizationError';
  }
}

const KEY_PREFIX_LENGTH = 17;
const PRODUCT_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

/**
 * Resolve tenant and product access through persistence interfaces.
 * The caller must apply rate limits before invoking this function.
 */
export async function authorizeProductRequest(
  apiKey: string,
  productId: string,
  repositories: AuthorizationRepositories,
): Promise<AuthorizedTenantContext> {
  if (!PRODUCT_ID_PATTERN.test(productId) || typeof apiKey !== 'string' || apiKey.length > 128) {
    throw new AuthorizationError();
  }
  const prefix = apiKey.slice(0, KEY_PREFIX_LENGTH);
  const key = await repositories.findApiKeyByPrefix(prefix);
  if (!key || key.status !== 'active' || !verifyApiKey(apiKey, key.verifier)) {
    throw new AuthorizationError();
  }
  const tenant = await repositories.findTenantById(key.tenantId);
  if (!tenant || tenant.status !== 'active') throw new AuthorizationError();
  const entitlement = await repositories.findProductEntitlement(tenant.id, productId);
  if (!entitlement || entitlement.status !== 'active') throw new AuthorizationError();
  return {
    tenantId: tenant.id,
    apiKeyId: key.id,
    productId,
    scopes: key.scopes,
  };
}
