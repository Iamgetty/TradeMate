const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRlsAwarePool, databaseRequestContextMiddleware, sessionTokenFromCookieHeader } = require('../dist/database-context');

const hash = (token) => createHash('sha256').update(token).digest('hex');
const createMockPool = ({ failOnSql, failOnceOnSql } = {}) => {
  let failOnceTriggered = false;
  const clients = [];
  const pool = {
    async connect() {
      const client = {
        calls: [],
        released: false,
        sessionHash: '',
        async query(sql, values) {
          this.calls.push({ sql, values });
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

test('pool queries set only the opaque session digest transaction-locally', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=raw-session-token', () => database.query('SELECT 1'));
  assert.equal(clients.length, 1);
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    "SELECT set_config('app.session_token_hash', $1, true)",
    'SELECT 1',
    'COMMIT',
  ]);
  assert.equal(clients[0].calls[1].values[0], hash('raw-session-token'));
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
    "SELECT set_config('app.session_token_hash', $1, true)",
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
  assert.equal(clients[0].calls[1].values[0], '');
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
    "SELECT set_config('app.session_token_hash', $1, true)",
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
    "SELECT set_config('app.session_token_hash', $1, true)",
    'ROLLBACK',
    'ROLLBACK',
  ]);
  assert.equal(clients[0].released, true);
});
