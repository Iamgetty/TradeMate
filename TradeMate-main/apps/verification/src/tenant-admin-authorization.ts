import type {
  TenantAdminMembershipRepository,
  TenantRepository,
} from './repository-contracts.js';

export interface VerifiedExternalIdentity {
  /** Claims from a JWT already signature/issuer/audience/expiry validated upstream. */
  issuer: string;
  subject: string;
}

export interface TenantAdminAuthorizationRepositories {
  tenants: Pick<TenantRepository, 'findById'>;
  tenantAdmins: Pick<TenantAdminMembershipRepository, 'findByIdentity'>;
}

export interface AuthorizedTenantAdminContext {
  tenantId: string;
  actorId: string;
  membershipId: string;
  role: 'owner' | 'admin';
  requestId: string;
}

export class TenantAdminAuthorizationError extends Error {
  constructor() {
    super('The authenticated identity is not authorized for this tenant operation.');
    this.name = 'TenantAdminAuthorizationError';
  }
}

/**
 * Resolve a tenant administrator from already-validated external identity
 * claims. This function does not validate JWT signatures or trust request JSON.
 */
export async function authorizeTenantAdmin(
  identity: VerifiedExternalIdentity,
  tenantId: string,
  requestId: string,
  repositories: TenantAdminAuthorizationRepositories,
): Promise<AuthorizedTenantAdminContext> {
  if (!identity || typeof identity.issuer !== 'string' || !identity.issuer ||
      typeof identity.subject !== 'string' || !identity.subject ||
      typeof tenantId !== 'string' || !tenantId ||
      typeof requestId !== 'string' || !requestId) {
    throw new TenantAdminAuthorizationError();
  }

  const tenant = await repositories.tenants.findById(tenantId);
  if (!tenant || tenant.status !== 'active') throw new TenantAdminAuthorizationError();

  const membership = await repositories.tenantAdmins.findByIdentity(
    tenantId,
    identity.issuer,
    identity.subject,
  );
  if (!membership || membership.tenantId !== tenantId || membership.status !== 'active' ||
      (membership.role !== 'owner' && membership.role !== 'admin')) {
    throw new TenantAdminAuthorizationError();
  }

  return {
    tenantId,
    actorId: membership.id,
    membershipId: membership.id,
    role: membership.role,
    requestId,
  };
}

/** Owner-only operations must explicitly require the owner role. */
export function requireTenantAdminRole(
  context: AuthorizedTenantAdminContext,
  requiredRole: 'owner' | 'admin',
): void {
  if (requiredRole === 'owner' && context.role !== 'owner') {
    throw new TenantAdminAuthorizationError();
  }
  if (requiredRole !== 'owner' && requiredRole !== 'admin') {
    throw new TenantAdminAuthorizationError();
  }
}
