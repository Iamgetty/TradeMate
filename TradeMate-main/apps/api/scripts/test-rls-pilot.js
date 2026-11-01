const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the RLS pilot test.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? true : undefined, max: 2 });
  const suffix = randomUUID();
  const users = [];
  let client;
  try {
    const policySql = await readFile(path.join(__dirname, '..', 'database', 'security', '003_rls_pilot.sql'), 'utf8');
    await pool.query(policySql);

    for (const label of ['a', 'b']) {
      const created = await pool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id::text AS id",
        [`rls-pilot-${label}-${suffix}@example.invalid`, `RLS pilot ${label}`],
      );
      const userId = created.rows[0].id;
      users.push(userId);
      await pool.query(
        'INSERT INTO user_profiles (user_id, bio) VALUES ($1, $2)',
        [userId, `Public bio ${label}`],
      );
      await pool.query(
        'INSERT INTO user_preferences (user_id, preferences) VALUES ($1, $2::jsonb)',
        [userId, JSON.stringify({ owner: label })],
      );
      await pool.query(
        "INSERT INTO user_notifications (user_id, category, title, body) VALUES ($1, 'System', $2, 'RLS pilot test')",
        [userId, `Private notification ${label}`],
      );
      await pool.query(
        'INSERT INTO user_auth_security (user_id, totp_enabled) VALUES ($1, false)',
        [userId],
      );
    }

    client = await pool.connect();
    await client.query('SET ROLE trademate_app');

    const inspectAs = async (userId) => {
      await client.query('BEGIN');
      try {
        await client.query("SELECT set_config('app.user_id', $1, true)", [userId || '']);
        const profiles = await client.query('SELECT user_id::text AS user_id FROM user_profiles ORDER BY user_id');
        const follows = await client.query('SELECT follower_user_id::text AS follower_user_id, followed_user_id::text AS followed_user_id FROM user_follows ORDER BY follower_user_id, followed_user_id');
        const preferences = await client.query('SELECT user_id::text AS user_id FROM user_preferences ORDER BY user_id');
        const notifications = await client.query('SELECT user_id::text AS user_id FROM user_notifications ORDER BY user_id');
        const security = await client.query('SELECT user_id::text AS user_id FROM user_auth_security ORDER BY user_id');
        await client.query('COMMIT');
        return { profiles, follows, preferences, notifications, security };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    };

    const a = await inspectAs(users[0]);
    assert.deepEqual(a.profiles.rows.map((row) => row.user_id), [...users].sort());
    assert.equal(a.follows.rowCount, 0);
    assert.deepEqual(a.preferences.rows.map((row) => row.user_id), [users[0]]);
    assert.deepEqual(a.notifications.rows.map((row) => row.user_id), [users[0]]);
    assert.deepEqual(a.security.rows.map((row) => row.user_id), [users[0]]);

    const b = await inspectAs(users[1]);
    assert.deepEqual(b.profiles.rows.map((row) => row.user_id), [...users].sort());
    assert.deepEqual(b.preferences.rows.map((row) => row.user_id), [users[1]]);
    assert.deepEqual(b.notifications.rows.map((row) => row.user_id), [users[1]]);
    assert.deepEqual(b.security.rows.map((row) => row.user_id), [users[1]]);

    const anonymous = await inspectAs('');
    assert.deepEqual(anonymous.profiles.rows.map((row) => row.user_id), [...users].sort());
    assert.equal(anonymous.follows.rowCount, 0);
    assert.equal(anonymous.preferences.rowCount, 0);
    assert.equal(anonymous.notifications.rowCount, 0);
    assert.equal(anonymous.security.rowCount, 0);

    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', $1, true)", [users[0]]);
    const ownProfileUpdate = await client.query('UPDATE user_profiles SET bio = $1 WHERE user_id = $2', ['Owner updated profile', users[0]]);
    const otherProfileUpdate = await client.query('UPDATE user_profiles SET bio = $1 WHERE user_id = $2', ['Tampered profile', users[1]]);
    assert.equal(ownProfileUpdate.rowCount, 1);
    assert.equal(otherProfileUpdate.rowCount, 0);
    const ownFollow = await client.query('INSERT INTO user_follows (follower_user_id, followed_user_id) VALUES ($1, $2) RETURNING follower_user_id', [users[0], users[1]]);
    assert.equal(ownFollow.rowCount, 1);
    await assert.rejects(
      client.query('INSERT INTO user_follows (follower_user_id, followed_user_id) VALUES ($1, $2)', [users[1], users[0]]),
      /row-level security policy/i,
    );
    const crossFollowDelete = await client.query('DELETE FROM user_follows WHERE follower_user_id = $1 AND followed_user_id = $2', [users[1], users[0]]);
    assert.equal(crossFollowDelete.rowCount, 0);
    const crossUserUpdate = await client.query(
      "UPDATE user_preferences SET preferences = '{\"owner\":\"tampered\"}'::jsonb WHERE user_id = $1",
      [users[1]],
    );
    assert.equal(crossUserUpdate.rowCount, 0);
    await assert.rejects(
      client.query('INSERT INTO user_preferences (user_id, preferences) VALUES ($1, $2::jsonb)', [users[1], '{"owner":"forged"}']),
      /row-level security policy/i,
    );
    await client.query('ROLLBACK');

    await client.query('RESET ROLE');
    await client.query('SET ROLE trademate_migrator');
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.user_id', '', true)");
    const ownerRows = await client.query('SELECT user_id FROM user_preferences');
    assert.equal(ownerRows.rowCount, 0, 'FORCE ROW LEVEL SECURITY must constrain the table owner too.');
    await client.query('ROLLBACK');
    await client.query('RESET ROLE');

    console.log('RLS pilot passed: private own-row access, public profile/follow reads, owner-only profile/follow writes, cross-user denial, anonymous default-deny and FORCE RLS owner enforcement.');
  } finally {
    if (client) {
      await client.query('RESET ROLE').catch(() => undefined);
      client.release();
    }
    for (const userId of users) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]).catch(() => undefined);
    }
    await pool.end();
  }
}

main().catch((error) => {
  console.error('RLS pilot test failed:', error);
  process.exitCode = 1;
});
