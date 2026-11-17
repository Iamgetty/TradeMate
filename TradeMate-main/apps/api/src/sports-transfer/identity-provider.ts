/**
 * Provider-neutral identity verification adapter contract.
 *
 * Implementations must return opaque provider references only. They must never
 * persist or log identity documents, biometrics, document numbers or raw payloads.
 * Provider outcomes are evidence for human review, not TradeMate decisions.
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
  /** Null when the adapter does not provide a hosted capture URL. */
  hostedUrl: string | null;
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

/**
 * Live vendor adapters must be explicitly registered only after their
 * vendor-specific signing, country coverage, retention and data-processing
 * contracts have been reviewed. Never silently fall back to another vendor.
 */
export const configuredIdentityProvider = (): IdentityProviderKey | null => {
  const provider = process.env.SPORTS_TRANSFER_IDENTITY_PROVIDER;
  if (!provider) return null;
  if (provider === 'sandbox' && process.env.SPORTS_TRANSFER_SANDBOX_ENABLED === 'true') return 'sandbox';
  if (provider === 'sumsub' || provider === 'veriff' || provider === 'trulioo') {
    // Deliberately fail closed until a production adapter is implemented.
    return null;
  }
  return null;
};
