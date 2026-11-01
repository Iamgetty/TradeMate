const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { createRlsAwarePool, databaseRequestContextMiddleware } = require('../dist/database-context');

const sessionHash = (token) => createHash('sha256').update(token).digest('hex');

const runRequest = (cookie, action) => new Promise((resolve, reject) => {
  databaseRequestContextMiddleware({ headers: { cookie } }, {}, () => {
    Promise.resolve().then(action).then(resolve, reject);
  });
});

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the database context integration test.');
  const rawPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? true : undefined, max: 1 });
  const database = createRlsAwarePool(rawPool);
  const suffix = randomUUID();
  const users = [];
  try {
    for (const label of ['a', 'b']) {
      const created = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id::text AS id",
        [`rls-context-${label}-${suffix}@example.invalid`, `RLS context ${label}`],
      );
      const userId = created.rows[0].id;
      const token = `test-session-${label}-${suffix}`;
      await rawPool.query(
        'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\')',
        [userId, sessionHash(token)],
      );
      users.push({ userId, token });
    }

    const inspect = () => database.query(
      "SELECT current_setting('app.session_token_hash', true) AS session_hash, current_setting('app.user_id', true) AS user_id",
    );

    const [a, b] = await Promise.all([
      runRequest(`trademate_session=${users[0].token}`, inspect),
      runRequest(`trademate_session=${users[1].token}`, inspect),
    ]);
    assert.equal(a.rows[0].session_hash, sessionHash(users[0].token));
    assert.equal(a.rows[0].user_id, users[0].userId);
    assert.equal(b.rows[0].session_hash, sessionHash(users[1].token));
    assert.equal(b.rows[0].user_id, users[1].userId);

    const anonymous = await runRequest('', inspect);
    assert.equal(anonymous.rows[0].session_hash, '');
    assert.equal(anonymous.rows[0].user_id, '');

    console.log('PostgreSQL transaction-local user context and single-connection isolation passed.');
  } finally {
    for (const user of users) {
      await rawPool.query('DELETE FROM user_sessions WHERE user_id = $1', [user.userId]).catch(() => undefined);
      await rawPool.query('DELETE FROM users WHERE id = $1', [user.userId]).catch(() => undefined);
    }
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Database context integration test failed:', error);
  process.exitCode = 1;
});
