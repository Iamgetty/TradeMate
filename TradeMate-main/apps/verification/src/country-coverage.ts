/**
 * Country-aware VeriFire coverage registry and provider routing contracts.
 * Registry records contain capability metadata only—never provider credentials,
 * end-user passwords, identity evidence, or raw provider responses.
 */
export const AFRICAN_ISO2_CODES = [
  'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG',
  'GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML',
  'MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD',
  'TZ','TG','TN','UG','ZM','ZW',
] as const;

export type AfricanCountryCode = typeof AFRICAN_ISO2_CODES[number];
export type CoverageStatus = 'not_assessed' | 'planned' | 'pilot' | 'live' | 'degraded' | 'suspended';

export interface CountryProductCoverage {
  countryCode: AfricanCountryCode;
  productId: string;
  status: CoverageStatus;
  supportedSubjectTypes: readonly ('person' | 'business')[];
  assuranceLevels: readonly string[];
  approvedAdapterKeys: readonly string[];
  policyVersion: string;
  effectiveFrom: string;
  reviewedAt: string;
  /** All gates must be true before a route can be marked live. */
  approvals: {
    legal: boolean;
    providerContract: boolean;
    security: boolean;
    operations: boolean;
    privacyAndTransfer: boolean;
  };
}

export interface CountryCoverageRegistry {
  version: string;
  entries: readonly CountryProductCoverage[];
}

export interface CoverageRequest {
  countryCode: string;
  productId: string;
  subjectType: 'person' | 'business';
  assuranceLevel: string;
  now?: Date;
}

export interface ApprovedProviderAdapter {
  /** Stable internal adapter identifier, not a credential or provider account. */
  adapterKey: string;
  countryCodes: readonly AfricanCountryCode[];
  productIds: readonly string[];
  assuranceLevels: readonly string[];
  status: 'enabled' | 'disabled';
}

export class CoverageUnavailableError extends Error {
  constructor() {
    super('The requested country and verification capability are not currently available.');
    this.name = 'CoverageUnavailableError';
  }
}

const PRODUCT_ID = /^[a-z][a-z0-9-]{1,63}$/;
const POLICY_VERSION = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function isAfricanCountryCode(value: string): value is AfricanCountryCode {
  return (AFRICAN_ISO2_CODES as readonly string[]).includes(value);
}

export function validateCoverageRegistry(registry: CountryCoverageRegistry): void {
  if (!registry.version || registry.version.length > 64) throw new Error('Invalid coverage registry version.');
  const seen = new Set<string>();
  for (const entry of registry.entries) {
    if (!isAfricanCountryCode(entry.countryCode) || !PRODUCT_ID.test(entry.productId) ||
        !POLICY_VERSION.test(entry.policyVersion) ||
        !Number.isFinite(Date.parse(entry.effectiveFrom)) ||
        !Number.isFinite(Date.parse(entry.reviewedAt)) ||
        entry.supportedSubjectTypes.length === 0 ||
        entry.approvedAdapterKeys.some((key) => !/^[a-z][a-z0-9-]{1,63}$/.test(key))) {
      throw new Error('Invalid country coverage entry.');
    }
    const key = entry.countryCode + ':' + entry.productId;
    if (seen.has(key)) throw new Error('Duplicate country/product coverage entry.');
    seen.add(key);
    if (entry.status === 'live' &&
        (!entry.approvals.legal || !entry.approvals.providerContract ||
         !entry.approvals.security || !entry.approvals.operations ||
         !entry.approvals.privacyAndTransfer || entry.approvedAdapterKeys.length === 0)) {
      throw new Error('Live coverage requires every approval gate and an approved adapter.');
    }
  }
}

/** Resolve only an explicitly live country/product/assurance route. */
export function resolveCountryCoverage(
  registry: CountryCoverageRegistry,
  adapters: readonly ApprovedProviderAdapter[],
  request: CoverageRequest,
): { coverage: CountryProductCoverage; adapter: ApprovedProviderAdapter } {
  validateCoverageRegistry(registry);
  const now = request.now ?? new Date();
  if (!Number.isFinite(now.getTime()) || !isAfricanCountryCode(request.countryCode) ||
      !PRODUCT_ID.test(request.productId)) throw new CoverageUnavailableError();

  const coverage = registry.entries.find((entry) =>
    entry.countryCode === request.countryCode && entry.productId === request.productId);
  if (!coverage || coverage.status !== 'live' ||
      Date.parse(coverage.effectiveFrom) > now.getTime() ||
      !coverage.supportedSubjectTypes.includes(request.subjectType) ||
      !coverage.assuranceLevels.includes(request.assuranceLevel)) {
    throw new CoverageUnavailableError();
  }

  const adapter = adapters.find((candidate) =>
    coverage.approvedAdapterKeys.includes(candidate.adapterKey) &&
    candidate.status === 'enabled' &&
    candidate.countryCodes.includes(coverage.countryCode) &&
    candidate.productIds.includes(coverage.productId) &&
    candidate.assuranceLevels.includes(request.assuranceLevel));
  if (!adapter) throw new CoverageUnavailableError();
  return { coverage, adapter };
}
