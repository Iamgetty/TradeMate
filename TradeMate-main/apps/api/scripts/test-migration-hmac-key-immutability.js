const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  const originalKey = process.env.RLS_CONTEXT_HMAC_KEY || '';
  if (!connectionString) throw new Error('RLS_PILOT_TEST_DATABASE_URL is required.');
  if (!/^[0-9a-f]{64}$/i.test(originalKey)) throw new Error('RLS_CONTEXT_HMAC_KEY must be a 32-byte hex key.');

  const migrationScript = path.join(__dirname, 'migrate.js');
  const runMigration = (key) => spawnSync(process.execPath, [migrationScript], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: connectionString, MIGRATION_DATABASE_URL: '', RLS_CONTEXT_HMAC_KEY: key },
  });
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const before = await pool.query(
      'SELECT encode(key_bytes, \'hex\') AS key_hex FROM trademate_private.rls_context_hmac_keys WHERE singleton = TRUE',
    );
    assert.equal(before.rowCount, 1, 'The initial migration must provision exactly one verifier key.');
    assert.equal(before.rows[0].key_hex, originalKey.toLowerCase());

    const wrongKey = 'f'.repeat(64) === originalKey.toLowerCase() ? 'e'.repeat(64) : 'f'.repeat(64);
    const rejected = runMigration(wrongKey);
    assert.notEqual(rejected.status, 0, 'A routine migration run with a different key must fail closed.');
    assert.match(rejected.stderr + rejected.stdout, /does not match the database verifier key/);

    const afterRejected = await pool.query(
      'SELECT encode(key_bytes, \'hex\') AS key_hex FROM trademate_private.rls_context_hmac_keys WHERE singleton = TRUE',
    );
    assert.equal(afterRejected.rows[0].key_hex, originalKey.toLowerCase(), 'A rejected run must not rotate the active verifier key.');

    const accepted = runMigration(originalKey);
    assert.equal(accepted.status, 0, 'A routine migration run with the matching verifier key must succeed.');

    const afterAccepted = await pool.query(
      'SELECT encode(key_bytes, \'hex\') AS key_hex FROM trademate_private.rls_context_hmac_keys WHERE singleton = TRUE',
    );
    assert.equal(afterAccepted.rows[0].key_hex, originalKey.toLowerCase());
    console.log('Migration HMAC verifier key immutability checks passed.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration HMAC key immutability test failed:', error);
    process.exitCode = 1;
  });
}
