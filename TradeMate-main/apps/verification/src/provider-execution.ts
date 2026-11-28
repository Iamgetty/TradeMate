import { ALLOWED_OUTCOMES, type CreateVerificationRequest, type VerificationCheckResult } from './contracts.js';
import { assertAdapterSupports, type ProviderAdapter, type ProviderVerificationContext } from './provider-adapter.js';

export class ProviderExecutionError extends Error {
  constructor() {
    super('The verification provider could not complete this check.');
    this.name = 'ProviderExecutionError';
  }
}

const REASON_CODE = /^[A-Z][A-Z0-9_:-]{0,63}$/;
const PROVIDER_REFERENCE = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Execute one provider check outside any database transaction.
 *
 * The adapter boundary is deliberately narrow: provider output is validated
 * and rebuilt from an allowlist before it can enter VeriFire's domain model.
 * Raw provider payloads and arbitrary provider error messages are discarded.
 */
export async function executeProviderCheck(
  adapter: ProviderAdapter,
  request: CreateVerificationRequest,
  context: ProviderVerificationContext,
): Promise<VerificationCheckResult> {
  assertAdapterSupports(adapter, request.countryCode, request.kind);

  let result: VerificationCheckResult;
  try {
    result = await adapter.verify(request, context);
  } catch {
    // Provider exceptions can contain credentials, identifiers or raw payloads.
    throw new ProviderExecutionError();
  }

  if (
    !result ||
    result.check !== request.kind ||
    !ALLOWED_OUTCOMES.includes(result.outcome) ||
    typeof result.checkedAt !== 'string' ||
    !Number.isFinite(Date.parse(result.checkedAt)) ||
    !Array.isArray(result.reasonCodes) ||
    result.reasonCodes.length > 32 ||
    !result.reasonCodes.every((code) => typeof code === 'string' && REASON_CODE.test(code)) ||
    !result.source ||
    result.source.provider !== adapter.key ||
    (result.source.reference !== undefined &&
      (typeof result.source.reference !== 'string' || !PROVIDER_REFERENCE.test(result.source.reference)))
  ) {
    throw new ProviderExecutionError();
  }

  return {
    check: request.kind,
    outcome: result.outcome,
    reasonCodes: [...result.reasonCodes],
    checkedAt: new Date(result.checkedAt).toISOString(),
    source: {
      provider: adapter.key,
      ...(result.source.reference === undefined ? {} : { reference: result.source.reference }),
    },
  };
}
