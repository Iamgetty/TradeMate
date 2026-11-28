import test from 'node:test';
import assert from 'node:assert/strict';
import { executeProviderCheck, ProviderExecutionError } from '../dist/provider-execution.js';

const request = {
  kind: 'government_id',
  countryCode: 'NG',
  subject: { reference: 'customer-ref-123', type: 'individual' },
  consent: { captured: true, capturedAt: '2026-11-28T10:00:00.000Z', noticeVersion: '2026-01' },
};
const context = {
  tenantId: 'tenant-1',
  verificationId: 'verification-1',
  policyVersion: 'ng-kyc-1',
  requestedAt: '2026-11-28T10:00:00.000Z',
};
const validResult = {
  check: 'government_id',
  outcome: 'verified',
  reasonCodes: ['DOCUMENT_VALID'],
  checkedAt: '2026-11-28T10:00:01.000Z',
  source: { provider: 'mock-ng-id', reference: 'provider-ref-1' },
};
function mockAdapter(verify = async () => validResult) {
  return {
    key: 'mock-ng-id',
    capabilities: { countryCodes: ['NG'], verificationKinds: ['government_id'] },
    verify,
  };
}

test('executes a compatible provider and returns only normalized allowlisted fields', async () => {
  const adapter = mockAdapter(async () => ({ ...validResult, rawPayload: { nationalId: 'must-not-escape' } }));
  const result = await executeProviderCheck(adapter, request, context);
  assert.deepEqual(result, validResult);
  assert.equal('rawPayload' in result, false);
});

test('does not call an adapter that lacks country or check capability', async () => {
  let called = false;
  const adapter = mockAdapter(async () => { called = true; return validResult; });
  await assert.rejects(
    executeProviderCheck({ ...adapter, capabilities: { countryCodes: ['GH'], verificationKinds: ['government_id'] } }, request, context),
    /not approved/,
  );
  assert.equal(called, false);
});

test('rejects mismatched checks, provider identity, invalid outcomes and unsafe reason codes', async () => {
  for (const result of [
    { ...validResult, check: 'face_match' },
    { ...validResult, source: { provider: 'unexpected-provider' } },
    { ...validResult, outcome: 'maybe' },
    { ...validResult, reasonCodes: ['national-id:123456'] },
    { ...validResult, checkedAt: 'not-a-date' },
    { ...validResult, reasonCodes: Array(33).fill('DOCUMENT_VALID') },
  ]) {
    await assert.rejects(executeProviderCheck(mockAdapter(async () => result), request, context), ProviderExecutionError);
  }
});

test('provider exceptions are replaced with a generic error without leaking details', async () => {
  await assert.rejects(
    executeProviderCheck(mockAdapter(async () => { throw new Error('secret=provider-password'); }), request, context),
    (error) => error instanceof ProviderExecutionError && !error.message.includes('provider-password'),
  );
});
