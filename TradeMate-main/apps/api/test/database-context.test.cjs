const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRlsAwarePool, databaseRequestContextMiddleware } = require('../dist/database-context');

const createMockPool = () => {
  const clients = [];
  const pool = {
    async connect() {
      const client = {
        calls: [],
        released: false,
        async query(sql, values) {
          this.calls.push({ sql, values });
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

test('pool queries set a hashed session identity inside a transaction and commit', async () => {
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
  assert.equal(
    clients[0].calls[1].values[0],
    createHash('sha256').update('raw-session-token').digest('hex'),
  );
  assert.equal(clients[0].released, true);
});

test('explicit transactions keep request context until commit', async () => {
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
  assert.equal(clients[0].calls[1].values[0], createHash('sha256').update('second-token').digest('hex'));
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
  const identities = clients.map((client) => client.calls.find((call) => call.sql.includes('set_config')).values[0]);
  assert.deepEqual(new Set(identities), new Set([
    createHash('sha256').update('user-a-token').digest('hex'),
    createHash('sha256').update('user-b-token').digest('hex'),
  ]));
  assert.ok(clients.every((client) => client.released));
});

test('malformed cookie encoding produces anonymous context without leaking raw input', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=%E0%A4%A', () => database.query('SELECT 1'));
  assert.equal(clients[0].calls[1].values[0], '');
});
