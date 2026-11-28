import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AFRICAN_ISO2_CODES, CoverageUnavailableError, isAfricanCountryCode,
  resolveCountryCoverage, validateCoverageRegistry,
} from '../dist/country-coverage.js';

const approvals = { legal: true, providerContract: true, security: true, operations: true, privacyAndTransfer: true };
const live = {
  countryCode: 'NG', productId: 'kyc', status: 'live',
  supportedSubjectTypes: ['person'], assuranceLevels: ['standard'],
  approvedAdapterKeys: ['provider-ng-kyc'], policyVersion: 'ng-kyc-1',
  effectiveFrom: '2026-01-01T00:00:00.000Z', reviewedAt: '2026-11-01T00:00:00.000Z',
  approvals,
};
const adapter = {
  adapterKey: 'provider-ng-kyc', countryCodes: ['NG'], productIds: ['kyc'],
  assuranceLevels: ['standard'], status: 'enabled',
};
const now = new Date('2026-11-28T12:00:00.000Z');

test('African ISO country list contains 54 unique country codes', () => {
  assert.equal(AFRICAN_ISO2_CODES.length, 54);
  assert.equal(new Set(AFRICAN_ISO2_CODES).size, 54);
  assert.equal(isAfricanCountryCode('NG'), true);
  assert.equal(isAfricanCountryCode('US'), false);
});

test('live country/product resolves only an explicitly approved compatible adapter', () => {
  const result = resolveCountryCoverage({ version: '1', entries: [live] }, [adapter], {
    countryCode: 'NG', productId: 'kyc', subjectType: 'person', assuranceLevel: 'standard', now,
  });
  assert.equal(result.adapter.adapterKey, 'provider-ng-kyc');
});

test('planned, suspended, future-effective and unapproved live routes fail closed', () => {
  const request = { countryCode: 'NG', productId: 'kyc', subjectType: 'person', assuranceLevel: 'standard', now };
  for (const status of ['planned', 'suspended', 'degraded']) {
    assert.throws(() => resolveCountryCoverage({ version: '1', entries: [{ ...live, status }] }, [adapter], request), CoverageUnavailableError);
  }
  assert.throws(() => resolveCountryCoverage({ version: '1', entries: [{ ...live, effectiveFrom: '2027-01-01T00:00:00.000Z' }] }, [adapter], request), CoverageUnavailableError);
  assert.throws(() => resolveCountryCoverage({ version: '1', entries: [{ ...live, approvals: { ...approvals, legal: false } }] }, [adapter], request));
});

test('wrong country, product, subject, assurance or disabled adapter cannot route', () => {
  const registry = { version: '1', entries: [live] };
  assert.throws(() => resolveCountryCoverage(registry, [adapter], { countryCode: 'GH', productId: 'kyc', subjectType: 'person', assuranceLevel: 'standard', now }), CoverageUnavailableError);
  assert.throws(() => resolveCountryCoverage(registry, [adapter], { countryCode: 'NG', productId: 'kyc', subjectType: 'business', assuranceLevel: 'standard', now }), CoverageUnavailableError);
  assert.throws(() => resolveCountryCoverage(registry, [{ ...adapter, status: 'disabled' }], { countryCode: 'NG', productId: 'kyc', subjectType: 'person', assuranceLevel: 'standard', now }), CoverageUnavailableError);
});

test('registry rejects duplicate country/product records', () => {
  assert.throws(() => validateCoverageRegistry({ version: '1', entries: [live, live] }));
});
