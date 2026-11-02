const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const workerPath = path.join(__dirname, '..', 'scripts', 'process-account-deletions.js');

function runWorker(overrides = {}) {
  return spawnSync(process.execPath, [workerPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://must-not-be-used.invalid/trademate',
      WORKER_DATABASE_URL: '',
      ACCOUNT_DELETION_EXECUTE: 'false',
      ACCOUNT_DELETION_LEGAL_APPROVAL: 'false',
      ...overrides,
    },
    timeout: 5000,
  });
}

test('production worker refuses to fall back to DATABASE_URL', () => {
  const result = runWorker();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /WORKER_DATABASE_URL is required in production/);
});

test('worker refuses permanent deletion without explicit legal approval', () => {
  const result = runWorker({
    WORKER_DATABASE_URL: 'postgres://worker:worker@127.0.0.1:1/trademate',
    ACCOUNT_DELETION_EXECUTE: 'true',
    ACCOUNT_DELETION_LEGAL_APPROVAL: 'false',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Permanent account deletion is blocked/);
});
