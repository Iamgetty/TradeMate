import test from 'node:test';
import assert from 'node:assert/strict';
import { issueApiKey, verifyApiKey } from '../dist/api-keys.js';

test('issued API keys are random, prefixed and represented by a verifier', () => {
  const first = issueApiKey();
  const second = issueApiKey();
  assert.match(first.plaintext, /^vfy_live_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.plaintext, second.plaintext);
  assert.match(first.verifier, /^[a-f0-9]{64}$/);
  assert.equal(first.verifier.includes(first.plaintext), false);
  assert.equal(first.prefix, first.plaintext.slice(0, 17));
});

test('API key verifier accepts only the matching key', () => {
  const issued = issueApiKey();
  assert.equal(verifyApiKey(issued.plaintext, issued.verifier), true);
  assert.equal(verifyApiKey(`${issued.plaintext}x`, issued.verifier), false);
  assert.equal(verifyApiKey('not-a-key', issued.verifier), false);
  assert.equal(verifyApiKey(issued.plaintext, 'invalid'), false);
});
