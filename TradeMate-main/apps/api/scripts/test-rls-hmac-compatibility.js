const assert = require('node:assert/strict');
const { createHmac, randomBytes } = require('node:crypto');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error('RLS_PILOT_TEST_DATABASE_URL is required for the disposable pgcrypto compatibility test.');
  }

  const pool = new Pool({ connectionString, max: 1 });
  const key = randomBytes(32);
  const keyHex = key.toString('hex');
  const message = JSON.stringify({
    version: 1,
    subject: '00000000-0000-4000-8000-000000000001',
    audience: 'trademate-postgres-rls',
    backendPid: 12345,
    transactionId: '9223372036854775000',
    issuedAt: 1795152000,
    expiresAt: 1795152030,
    nonce: 'disposable-ci-nonce',
  });
  const expected = createHmac('sha256', key).update(message, 'utf8').digest('hex');

  try {
    await pool.query('CREATE SCHEMA IF NOT EXISTS crypto_test');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA crypto_test');

    const valid = await pool.query(
      "SELECT encode(crypto_test.hmac(convert_to($1, 'UTF8'), decode($2, 'hex'), 'sha256'), 'hex') AS mac",
      [message, keyHex],
    );
    assert.equal(valid.rows[0].mac, expected, 'PostgreSQL pgcrypto HMAC must match Node.js HMAC-SHA-256.');

    const altered = await pool.query(
      "SELECT crypto_test.hmac(convert_to($1, 'UTF8'), decode($2, 'hex'), 'sha256') = decode($3, 'hex') AS valid",
      [message + ' ', keyHex, expected],
    );
    assert.equal(altered.rows[0].valid, false, 'A modified message must not validate.');

    const wrongKey = await pool.query(
      "SELECT crypto_test.hmac(convert_to($1, 'UTF8'), decode($2, 'hex'), 'sha256') = decode($3, 'hex') AS valid",
      [message, randomBytes(32).toString('hex'), expected],
    );
    assert.equal(wrongKey.rows[0].valid, false, 'A different key must not validate.');

    console.log('pgcrypto HMAC-SHA-256 compatibility and tamper checks passed; test key remained in disposable CI memory.');
  } finally {
    key.fill(0);
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('pgcrypto HMAC compatibility check failed:', error);
    process.exitCode = 1;
  });
}
