export const VERIFICATION_API_VERSION = 'v1' as const;

export type VerificationKind =
  | 'individual_identity'
  | 'government_id'
  | 'face_match'
  | 'liveness'
  | 'business_registry'
  | 'business_ownership';

export type VerificationOutcome =
  | 'verified'
  | 'not_verified'
  | 'inconclusive'
  | 'manual_review'
  | 'not_supported';

export type VerificationStatus =
  | 'accepted'
  | 'processing'
  | 'completed'
  | 'failed';

export interface CreateVerificationRequest {
  kind: VerificationKind;
  countryCode: string;
  subject: {
    reference: string;
    type: 'individual' | 'business';
  };
  consent: {
    captured: boolean;
    capturedAt: string;
    noticeVersion: string;
  };
  callback?: {
    eventProfile: 'standard';
  };
}

export interface VerificationCheckResult {
  check: VerificationKind;
  outcome: VerificationOutcome;
  reasonCodes: string[];
  checkedAt: string;
  source: {
    provider: string;
    reference?: string;
  };
}

export interface VerificationResult {
  id: string;
  status: VerificationStatus;
  outcome?: VerificationOutcome;
  countryCode: string;
  policyVersion: string;
  createdAt: string;
  updatedAt: string;
  checks: VerificationCheckResult[];
}

export interface VerificationError {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export const ALLOWED_OUTCOMES: readonly VerificationOutcome[] = [
  'verified',
  'not_verified',
  'inconclusive',
  'manual_review',
  'not_supported',
] as const;

export function isCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}
