const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, createHmac } = require('node:crypto');
process.env.RLS_CONTEXT_HMAC_KEY = 'a'.repeat(64);
const { createRlsAwarePool, databaseRequestContextMiddleware, sessionTokenFromCookieHeader } = require('../dist/database-context');

const hash = (token) => createHash('sha256').update(token).digest('hex');
const createMockPool = ({ failOnSql, failOnceOnSql } = {}) => {
  let failOnceTriggered = false;
  const clients = [];
  let transactionSequence = 40;
  const pool = {
    async connect() {
      const client = {
        calls: [],
        released: false,
        sessionHash: '',
        async query(sql, values) {
          this.calls.push({ sql, values });
          if (sql.includes('SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid')) {
            transactionSequence += 1;
            return { rows: [{ transaction_id: String(transactionSequence), backend_pid: String(1000 + clients.length) }], rowCount: 1 };
          }
          if (failOnSql && sql.includes(failOnSql)) throw new Error('simulated database context setup failure');
          if (failOnceOnSql && !failOnceTriggered && sql.includes(failOnceOnSql)) {
            failOnceTriggered = true;
            throw new Error('simulated one-time database rollback failure');
          }
          if (sql.includes("set_config('app.session_token_hash'")) this.sessionHash = values[0];
          return { rows: [], rowCount: 0 };
        },
        release() { this.released = true; },
      };
      clients.push(client);
      return client;
    },
    async query(sql, values) {
      return { rows: [{ sql, values }], rowCount: 1 };
    },
    async end() {},
  };
  return { pool, clients };
};

const runRequest = (cookie, action) => new Promise((resolve, reject) => {
  const request = { headers: { cookie } };
  databaseRequestContextMiddleware(request, {}, () => {
    Promise.resolve().then(action).then(resolve, reject);
  });
});

test('pool queries sign the opaque session digest for the current transaction and backend', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=raw-session-token', () => database.query('SELECT 1'));
  assert.equal(clients.length, 1);
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    'SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid',
    "SELECT set_config('app.session_token_hash', $1, true), set_config('app.session_transaction_id', $2, true), set_config('app.session_backend_pid', $3, true), set_config('app.session_signature', $4, true)",
    'SELECT 1',
    'COMMIT',
  ]);
  const contextValues = clients[0].calls[2].values;
  assert.equal(contextValues[0], hash('raw-session-token'));
  assert.equal(contextValues[1], '41');
  assert.equal(contextValues[2], '1001');
  const payload = 'trademate-rls-context:v1|' + contextValues[1] + '|' + contextValues[2] + '|' + contextValues[0];
  assert.equal(contextValues[3], createHmac('sha256', Buffer.from(process.env.RLS_CONTEXT_HMAC_KEY, 'hex')).update(payload, 'utf8').digest('hex'));
  assert.equal(clients[0].released, true);
});

test('explicit transactions keep the presented session digest until commit', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=second-token', async () => {
    const client = await database.connect();
    await client.query('BEGIN');
    await client.query('UPDATE user_preferences SET language=$1', ['English']);
    await client.query('COMMIT');
    client.release();
  });
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    'SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid',
    "SELECT set_config('app.session_token_hash', $1, true), set_config('app.session_transaction_id', $2, true), set_config('app.session_backend_pid', $3, true), set_config('app.session_signature', $4, true)",
    'UPDATE user_preferences SET language=$1',
    'COMMIT',
  ]);
  assert.equal(clients[0].released, true);
});

test('concurrent requests cannot reuse each other’s transaction identity', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await Promise.all([
    runRequest('trademate_session=user-a-token', () => database.query('SELECT $1', ['A'])),
    runRequest('trademate_session=user-b-token', () => database.query('SELECT $1', ['B'])),
  ]);
  assert.equal(clients.length, 2);
  const hashes = clients.map((client) => client.sessionHash);
  assert.deepEqual(new Set(hashes), new Set([hash('user-a-token'), hash('user-b-token')]));
  assert.ok(clients.every((client) => client.released));
});

test('malformed cookie encoding produces anonymous context without leaking raw input', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=%E0%A4%A', () => database.query('SELECT 1'));
  assert.equal(clients[0].calls[2].values[0], '');
  assert.ok(!clients[0].calls.some((call) => call.values?.includes('%E0%A4%A')));
});


test('shared session cookie parser decodes valid cookies and fails closed on malformed encoding', () => {
  assert.equal(sessionTokenFromCookieHeader('theme=dark; trademate_session=valid%2Dtoken'), 'valid-token');
  assert.equal(sessionTokenFromCookieHeader('trademate_session=%E0%A4%A'), '');
  assert.equal(sessionTokenFromCookieHeader('trademate_session=bad%ZZ'), '');
  assert.equal(sessionTokenFromCookieHeader('other_cookie=value'), '');
  assert.equal(sessionTokenFromCookieHeader(undefined), '');
});

test('explicit transaction is rolled back when request session context setup fails', async () => {
  const { pool, clients } = createMockPool({ failOnSql: "set_config('app.session_token_hash'" });
  const database = createRlsAwarePool(pool);
  await assert.rejects(runRequest('trademate_session=raw-session-token', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
    } finally {
      client.release();
    }
  }), /simulated database context setup failure/);
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    'SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid',
    "SELECT set_config('app.session_token_hash', $1, true), set_config('app.session_transaction_id', $2, true), set_config('app.session_backend_pid', $3, true), set_config('app.session_signature', $4, true)",
    'ROLLBACK',
  ]);
  assert.equal(clients[0].released, true);
});



test('release retries rollback when the setup-failure rollback also fails', async () => {
  const { pool, clients } = createMockPool({
    failOnSql: "set_config('app.session_token_hash'",
    failOnceOnSql: 'ROLLBACK',
  });
  const database = createRlsAwarePool(pool);
  await assert.rejects(runRequest('trademate_session=raw-session-token', async () => {
    const client = await database.connect();
    try {
      await client.query('BEGIN');
    } finally {
      client.release();
    }
  }), /simulated database context setup failure/);

  // release() intentionally schedules its final rollback before returning.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    'SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid',
    "SELECT set_config('app.session_token_hash', $1, true), set_config('app.session_transaction_id', $2, true), set_config('app.session_backend_pid', $3, true), set_config('app.session_signature', $4, true)",
    'ROLLBACK',
    'ROLLBACK',
  ]);
  assert.equal(clients[0].released, true);
});
