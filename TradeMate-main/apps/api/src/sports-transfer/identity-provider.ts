import { createSumsubWebSdkSession, getSumsubApplicantStatus, verifySumsubWebhook } from './sumsub';

/**
 * Provider-neutral identity verification adapter contract.
 *
 * Implementations return opaque provider references only. Identity documents,
 * biometrics, document numbers and raw payloads must never enter TradeMate logs
 * or ordinary application tables. Provider outcomes are evidence for human
 * review, not TradeMate decisions.
 */
export type IdentityProviderKey = 'sandbox' | 'sumsub' | 'veriff' | 'trulioo';
export type IdentityProviderOutcome = 'succeeded' | 'failed' | 'review_required';

export interface CreateIdentitySessionInput {
  caseId: string;
  caseType: 'legal_identity';
  countryCode: string | null;
  returnUrl: string;
  idempotencyKey: string;
}

export interface CreatedIdentitySession {
  provider: IdentityProviderKey;
  providerSessionReference: string;
  expiresAt: Date;
  hostedUrl: string | null;
  /** Short-lived token returned only to the authenticated case owner. */
  clientToken?: string | null;
}

export interface IdentityProviderSessionStatus {
  provider: IdentityProviderKey;
  providerSessionReference: string;
  status: 'created' | 'submitted' | 'completed' | 'expired' | 'cancelled' | 'failed';
  outcome: IdentityProviderOutcome | null;
  checkedAt: Date;
}

export interface NormalizedIdentityWebhook {
  provider: IdentityProviderKey;
  eventId: string;
  caseReference: string;
  outcome: IdentityProviderOutcome;
  occurredAt: Date | null;
  payloadSha256: string;
}

export interface IdentityVerificationProviderAdapter {
  readonly provider: IdentityProviderKey;
  createSession(input: CreateIdentitySessionInput): Promise<CreatedIdentitySession>;
  getSessionStatus(providerSessionReference: string): Promise<IdentityProviderSessionStatus>;
  verifyWebhook(rawBody: Buffer, headers: Readonly<Record<string, string | undefined>>): Promise<NormalizedIdentityWebhook>;
}

/** Vendor credentials are supplied only through the deployment secret store. */
export const configuredIdentityProvider = (): IdentityProviderKey | null => {
  const provider = process.env.SPORTS_TRANSFER_IDENTITY_PROVIDER;
  if (provider === 'sandbox' && process.env.SPORTS_TRANSFER_SANDBOX_ENABLED === 'true') return 'sandbox';
  if (provider === 'sumsub'
    && !!process.env.SUMSUB_APP_TOKEN
    && !!process.env.SUMSUB_SECRET_KEY
    && !!process.env.SUMSUB_KYC_LEVEL_NAME
    && !!process.env.SUMSUB_WEBHOOK_SECRET) return 'sumsub';
  return null;
};

export { createSumsubWebSdkSession, getSumsubApplicantStatus, verifySumsubWebhook };
