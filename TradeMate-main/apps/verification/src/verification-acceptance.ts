import { createHash, randomUUID } from 'node:crypto';
import { requireScope, type AuthorizedTenantContext } from './authorization.js';
import type { CreateVerificationRequest } from './contracts.js';
import type { VeriFirePersistence, VerificationRequestRecord } from './repository-contracts.js';

const OPERATION = 'verification.create';
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/;
const EXTERNAL_REFERENCE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const PRODUCT_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;
const VERIFICATION_KINDS = new Set([
  'individual_identity',
  'government_id',
  'face_match',
  'liveness',
  'business_registry',
  'business_ownership',
]);

export class VerificationAcceptanceError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'idempotency_conflict' | 'not_authorized' | 'duplicate_reference',
  ) {
    const messages = {
      invalid_request: 'The verification request is invalid.',
      idempotency_conflict: 'The idempotency key was already used with different request details.',
      not_authorized: 'The tenant is not authorized to submit this verification.',
      duplicate_reference: 'A verification already exists for this external reference.',
    };
    super(messages[code]);
    this.name = 'VerificationAcceptanceError';
  }
}

export interface AcceptVerificationInput {
  /** Must be returned by authorizeProductRequest, never constructed from request JSON. */
  authorization: AuthorizedTenantContext;
  requestId: string;
  idempotencyKey: string;
  request: CreateVerificationRequest;
  policyVersion: string;
}

/**
 * Atomically accepts a verification, records its idempotency result, writes an
 * audit event and enqueues an outbox event. No provider network call occurs
 * here; a separate worker claims the outbox event after commit.
 */
export async function acceptVerificationRequest(
  persistence: VeriFirePersistence,
  input: AcceptVerificationInput,
  now: Date = new Date(),
): Promise<{ verification: VerificationRequestRecord; replayed: boolean }> {
  const { authorization, request, idempotencyKey, requestId, policyVersion } = input;
  if (
    !authorization?.tenantId ||
    !authorization.apiKeyId ||
    !PRODUCT_ID_PATTERN.test(authorization.productId) ||
    !requestId ||
    requestId.length > 128 ||
    !Number.isFinite(now.getTime()) ||
    typeof idempotencyKey !== 'string' ||
    !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey) ||
    !request ||
    !VERIFICATION_KINDS.has(request.kind) ||
    !/^[A-Z]{2}$/.test(request.countryCode) ||
    !request.subject ||
    !['individual', 'business'].includes(request.subject.type) ||
    typeof request.subject.reference !== 'string' ||
    !EXTERNAL_REFERENCE_PATTERN.test(request.subject.reference) ||
    !request.consent ||
    request.consent.captured !== true ||
    !Number.isFinite(Date.parse(request.consent.capturedAt)) ||
    typeof request.consent.noticeVersion !== 'string' ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(request.consent.noticeVersion) ||
    typeof policyVersion !== 'string' ||
    !/^[A-Za-z0-9._-]{1,64}$/.test(policyVersion)
  ) {
    throw new VerificationAcceptanceError('invalid_request');
  }

  try {
    requireScope(authorization, 'verification:create');
  } catch {
    throw new VerificationAcceptanceError('not_authorized');
  }

  const tenantId = authorization.tenantId;
  const productId = authorization.productId;
  const keyHash = createHash('sha256').update(idempotencyKey, 'utf8').digest('hex');
  const fingerprintInput = {
    productId,
    kind: request.kind,
    countryCode: request.countryCode,
    subjectType: request.subject.type,
    externalReference: request.subject.reference,
    consentCapturedAt: new Date(request.consent.capturedAt).toISOString(),
    consentNoticeVersion: request.consent.noticeVersion,
    policyVersion,
  };
  const requestFingerprint = createHash('sha256')
    .update(JSON.stringify(fingerprintInput), 'utf8')
    .digest('hex');
  const timestamp = now.toISOString();
  const verificationId = randomUUID();

  return persistence.withTransaction(async (tx) => {
    const previous = await tx.idempotency.find(tenantId, OPERATION, keyHash);
    if (previous) {
      if (previous.requestFingerprint !== requestFingerprint) {
        throw new VerificationAcceptanceError('idempotency_conflict');
      }
      const existing = await tx.verifications.findById(tenantId, previous.resourceId);
      if (!existing) throw new VerificationAcceptanceError('idempotency_conflict');
      return { verification: existing, replayed: true };
    }

    const tenant = await tx.tenants.findById(tenantId);
    const entitlement = await tx.entitlements.findForProduct(tenantId, productId);
    const startsAt = entitlement ? Date.parse(entitlement.startsAt) : Number.NaN;
    const expiresAt = entitlement?.expiresAt === null
      ? Number.POSITIVE_INFINITY
      : entitlement?.expiresAt
        ? Date.parse(entitlement.expiresAt)
        : Number.NaN;
    if (
      !tenant ||
      tenant.status !== 'active' ||
      !entitlement ||
      entitlement.status !== 'active' ||
      !Number.isFinite(startsAt) ||
      !Number.isFinite(expiresAt) && expiresAt !== Number.POSITIVE_INFINITY ||
      startsAt > now.getTime() ||
      now.getTime() >= expiresAt
    ) {
      throw new VerificationAcceptanceError('not_authorized');
    }

    const duplicate = await tx.verifications.findByExternalReference(
      tenantId,
      productId,
      request.subject.reference,
    );
    if (duplicate) throw new VerificationAcceptanceError('duplicate_reference');

    const verification = await tx.verifications.create({
      id: verificationId,
      tenantId,
      productId,
      externalReference: request.subject.reference,
      kind: request.kind,
      countryCode: request.countryCode,
      status: 'accepted',
      policyVersion,
      createdAt: timestamp,
    });

    await tx.idempotency.create({
      tenantId,
      keyHash,
      operation: OPERATION,
      requestFingerprint,
      resourceId: verificationId,
      responseStatus: 202,
      createdAt: timestamp,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    });

    await tx.audit.append({
      id: randomUUID(),
      tenantId,
      actorType: 'api_key',
      actorId: authorization.apiKeyId,
      action: 'verification.accepted',
      targetType: 'verification',
      targetId: verificationId,
      occurredAt: timestamp,
      requestId,
      metadata: {
        productId,
        kind: request.kind,
        countryCode: request.countryCode,
        policyVersion,
        consentNoticeVersion: request.consent.noticeVersion,
        consentCapturedAt: new Date(request.consent.capturedAt).toISOString(),
      },
    });

    await tx.outbox.append({
      id: randomUUID(),
      tenantId,
      eventType: 'verification.requested',
      aggregateId: verificationId,
      payload: { verificationId },
      createdAt: timestamp,
    });

    return { verification, replayed: false };
  });
}
