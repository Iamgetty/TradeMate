const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createRlsAwarePool, databaseRequestContextMiddleware } = require('../dist/database-context');

const hash = (token) => createHash('sha256').update(token).digest('hex');
const identityByHash = new Map([
  [hash('raw-session-token'), '11111111-1111-4111-8111-111111111111'],
  [hash('second-token'), '22222222-2222-4222-8222-222222222222'],
  [hash('user-a-token'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  [hash('user-b-token'), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
]);

const createMockPool = () => {
  const clients = [];
  const pool = {
    async connect() {
      const client = {
        calls: [],
        released: false,
        sessionHash: '',
        userId: '',
        async query(sql, values) {
          this.calls.push({ sql, values });
          if (sql.includes("set_config('app.session_token_hash'")) this.sessionHash = values[0];
          if (sql.includes('FROM user_sessions')) {
            const userId = identityByHash.get(this.sessionHash);
            return { rows: userId ? [{ user_id: userId }] : [], rowCount: userId ? 1 : 0 };
          }
          if (sql.includes("set_config('app.user_id'")) this.userId = values[0];
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

test('pool queries set hashed session and resolved user identity transaction-locally', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=raw-session-token', () => database.query('SELECT 1'));
  assert.equal(clients.length, 1);
  assert.deepEqual(clients[0].calls.map((call) => call.sql), [
    'BEGIN',
    "SELECT set_config('app.session_token_hash', $1, true)",
    "SELECT s.user_id::text AS user_id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
    "SELECT set_config('app.user_id', $1, true)",
    'SELECT 1',
    'COMMIT',
  ]);
  assert.equal(clients[0].calls[1].values[0], hash('raw-session-token'));
  assert.equal(clients[0].calls[3].values[0], '11111111-1111-4111-8111-111111111111');
  assert.equal(clients[0].released, true);
});

test('explicit transactions keep request identity until commit', async () => {
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
    "SELECT s.user_id::text AS user_id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
    "SELECT set_config('app.user_id', $1, true)",
    'UPDATE user_preferences SET language=$1',
    'COMMIT',
  ]);
  assert.equal(clients[0].userId, '22222222-2222-4222-8222-222222222222');
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
  const userIds = clients.map((client) => client.userId);
  assert.deepEqual(new Set(hashes), new Set([hash('user-a-token'), hash('user-b-token')]));
  assert.deepEqual(new Set(userIds), new Set([
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ]));
  assert.ok(clients.every((client) => client.released));
});

test('malformed cookie encoding produces anonymous context without leaking raw input', async () => {
  const { pool, clients } = createMockPool();
  const database = createRlsAwarePool(pool);
  await runRequest('trademate_session=%E0%A4%A', () => database.query('SELECT 1'));
  assert.equal(clients[0].calls[1].values[0], '');
  assert.equal(clients[0].userId, '');
  assert.ok(!clients[0].calls.some((call) => call.values?.includes('%E0%A4%A')));
});
