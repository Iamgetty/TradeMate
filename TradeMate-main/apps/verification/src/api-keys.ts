import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const API_KEY_PREFIX = 'vfy_live_';
const RANDOM_BYTES = 32;

export interface IssuedApiKey {
  /** Show this value once to the integrating developer; never persist it. */
  plaintext: string;
  /** Persist this verifier, not plaintext. */
  verifier: string;
  prefix: string;
}

export function issueApiKey(): IssuedApiKey {
  const secret = randomBytes(RANDOM_BYTES).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    verifier: hashApiKey(plaintext),
    prefix: plaintext.slice(0, API_KEY_PREFIX.length + 8),
  };
}

export function hashApiKey(apiKey: string): string {
  if (!apiKey.startsWith(API_KEY_PREFIX) || apiKey.length > 128) {
    throw new Error('API key format is invalid.');
  }
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

/** Compare a presented key to a stored SHA-256 verifier without a timing leak. */
export function verifyApiKey(apiKey: string, storedVerifier: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(storedVerifier)) return false;
  let candidate: string;
  try { candidate = hashApiKey(apiKey); } catch { return false; }
  return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(storedVerifier, 'hex'));
}
