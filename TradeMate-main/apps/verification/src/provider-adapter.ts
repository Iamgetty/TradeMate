import type {
  CreateVerificationRequest,
  VerificationCheckResult,
  VerificationKind,
} from './contracts.js';

export interface ProviderCapabilities {
  countryCodes: readonly string[];
  verificationKinds: readonly VerificationKind[];
}

export interface ProviderVerificationContext {
  tenantId: string;
  verificationId: string;
  policyVersion: string;
  requestedAt: string;
}

export interface ProviderAdapter {
  readonly key: string;
  readonly capabilities: ProviderCapabilities;

  verify(
    request: CreateVerificationRequest,
    context: ProviderVerificationContext,
  ): Promise<VerificationCheckResult>;
}

/**
 * Adapters may only be registered after legal authorization, provider access,
 * data-processing terms, retention and country coverage have been reviewed.
 * Implementations must return normalized/redacted results and must not persist
 * raw identity documents, biometrics, national identifiers or provider payloads.
 */
export function assertAdapterSupports(
  adapter: ProviderAdapter,
  countryCode: string,
  kind: VerificationKind,
): void {
  if (!adapter.capabilities.countryCodes.includes(countryCode)) {
    throw new Error(`Provider "${adapter.key}" is not approved for ${countryCode}.`);
  }
  if (!adapter.capabilities.verificationKinds.includes(kind)) {
    throw new Error(`Provider "${adapter.key}" does not support ${kind}.`);
  }
}
