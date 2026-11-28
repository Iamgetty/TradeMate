/**
 * Persistence-neutral VeriFire repository contracts.
 *
 * Production adapters must implement these contracts with tenant-scoped
 * queries and transactional guarantees. This file intentionally selects no
 * database and contains no in-memory production fallback.
 */
import type {
  ApiKeyRecord,
  EntitlementStatus,
  ProductEntitlement,
  TenantRecord,
  TenantStatus,
} from './authorization.js';

export interface TenantRecordWithTimestamps extends TenantRecord {
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyRecordWithTimestamps extends ApiKeyRecord {
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ProductEntitlementRecord extends ProductEntitlement {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantScopedQuery {
  /** Must come from authenticated API-key context, never request JSON. */
  tenantId: string;
}

export interface NewTenant {
  id: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NewApiKey {
  id: string;
  tenantId: string;
  prefix: string;
  verifier: string;
  status: 'active';
  scopes: readonly string[];
  expiresAt: string | null;
  createdAt: string;
}

export interface NewEntitlement {
  id: string;
  tenantId: string;
  productId: string;
  status: EntitlementStatus;
  startsAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewVerificationRequest {
  id: string;
  tenantId: string;
  productId: string;
  /** Opaque caller-generated reference; never an identity number. */
  externalReference: string;
  kind: string;
  countryCode: string;
  status: 'accepted';
  policyVersion: string;
  createdAt: string;
}

export interface VerificationRequestRecord extends NewVerificationRequest {
  status: 'accepted' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  outcome: 'clear' | 'review' | 'declined' | null;
  updatedAt: string;
  completedAt: string | null;
}

export interface NewIdempotencyRecord {
  tenantId: string;
  keyHash: string;
  operation: string;
  requestFingerprint: string;
  resourceId: string;
  responseStatus: number;
  createdAt: string;
  expiresAt: string;
}

export interface IdempotencyRecord extends NewIdempotencyRecord {}

export interface NewAuditEvent {
  id: string;
  tenantId: string;
  actorType: 'tenant_admin' | 'api_key' | 'system' | 'provider';
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  occurredAt: string;
  requestId: string;
  /** Strict allowlist only: no credentials, identity evidence or raw payloads. */
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface NewProviderExecution {
  id: string;
  tenantId: string;
  verificationId: string;
  adapterKey: string;
  providerReference: string | null;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  outcome: 'clear' | 'review' | 'declined' | null;
  reasonCodes: readonly string[];
  startedAt: string | null;
  completedAt: string | null;
}

export interface NewOutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateId: string;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
}

export interface TenantRepository {
  findById(id: string): Promise<TenantRecordWithTimestamps | null>;
  create(record: NewTenant): Promise<TenantRecordWithTimestamps>;
  updateStatus(id: string, status: TenantStatus, updatedAt: string): Promise<void>;
}

export interface ApiKeyRepository {
  findByPrefix(prefix: string): Promise<ApiKeyRecordWithTimestamps | null>;
  create(record: NewApiKey): Promise<ApiKeyRecordWithTimestamps>;
  revoke(tenantId: string, keyId: string, revokedAt: string): Promise<boolean>;
  touchLastUsed(tenantId: string, keyId: string, usedAt: string): Promise<void>;
}

export interface EntitlementRepository {
  findForProduct(tenantId: string, productId: string): Promise<ProductEntitlementRecord | null>;
  create(record: NewEntitlement): Promise<ProductEntitlementRecord>;
  updateStatus(tenantId: string, entitlementId: string, status: EntitlementStatus, updatedAt: string): Promise<boolean>;
}

export interface VerificationRepository {
  create(record: NewVerificationRequest): Promise<VerificationRequestRecord>;
  findById(tenantId: string, verificationId: string): Promise<VerificationRequestRecord | null>;
  findByExternalReference(tenantId: string, productId: string, externalReference: string): Promise<VerificationRequestRecord | null>;
}

export interface IdempotencyRepository {
  find(tenantId: string, operation: string, keyHash: string): Promise<IdempotencyRecord | null>;
  create(record: NewIdempotencyRecord): Promise<IdempotencyRecord>;
}

export interface AuditRepository {
  append(event: NewAuditEvent): Promise<void>;
}

export interface ProviderExecutionRepository {
  create(record: NewProviderExecution): Promise<void>;
  findForVerification(tenantId: string, verificationId: string): Promise<NewProviderExecution[]>;
}

export interface OutboxRepository {
  append(event: NewOutboxEvent): Promise<void>;
}

/**
 * Implementations must guarantee one ACID transaction across all methods used
 * in a callback. Tenant ownership must be checked on every tenant-scoped query.
 * No provider network call may execute inside this transaction.
 */
export interface VeriFireTransaction {
  tenants: TenantRepository;
  apiKeys: ApiKeyRepository;
  entitlements: EntitlementRepository;
  verifications: VerificationRepository;
  idempotency: IdempotencyRepository;
  audit: AuditRepository;
  providerExecutions: ProviderExecutionRepository;
  outbox: OutboxRepository;
}

export interface VeriFirePersistence {
  withTransaction<T>(work: (transaction: VeriFireTransaction) => Promise<T>): Promise<T>;
}
