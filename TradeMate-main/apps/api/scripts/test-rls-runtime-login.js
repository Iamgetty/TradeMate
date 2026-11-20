const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function main() {
  const adminConnectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!adminConnectionString) {
    throw new Error('RLS_PILOT_TEST_DATABASE_URL is required for the disposable real-login RLS test.');
  }

  const admin = new Pool({ connectionString: adminConnectionString, max: 1 });
  const suffix = randomUUID();
  const userIds = [];
  const appPassword = randomBytes(32).toString('hex');
  let appPool;
  let appClient;

  try {
    const role = await admin.query(
      "SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = 'trademate_app'",
    );
    assert.equal(role.rowCount, 1, 'trademate_app must exist after the role bootstrap migration.');
    assert.equal(role.rows[0].rolcanlogin, true, 'trademate_app must be a real LOGIN role.');
    assert.equal(role.rows[0].rolsuper, false);
    assert.equal(role.rows[0].rolcreatedb, false);
    assert.equal(role.rows[0].rolcreaterole, false);
    assert.equal(role.rows[0].rolbypassrls, false);

    // This password is generated only for the disposable CI database. It is
    // never read from or written to a production environment or repository.
    await admin.query(`ALTER ROLE trademate_app PASSWORD '${appPassword}'`);

    for (const label of ['owner', 'other']) {
      const user = await admin.query(
        "INSERT INTO public.users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id::text AS id",
        [`rls-login-${label}-${suffix}@example.invalid`, `RLS login ${label}`],
      );
      const userId = user.rows[0].id;
      userIds.push(userId);
      await admin.query(
        'INSERT INTO public.user_preferences (user_id, preferences) VALUES ($1, $2::jsonb)',
        [userId, JSON.stringify({ fixture: label })],
      );
    }

    const appUrl = new URL(adminConnectionString);
    appUrl.username = 'trademate_app';
    appUrl.password = appPassword;
    appPool = new Pool({ connectionString: appUrl.toString(), max: 1 });
    appClient = await appPool.connect();

    const identity = await appClient.query('SELECT session_user, current_user');
    assert.equal(identity.rows[0].session_user, 'trademate_app');
    assert.equal(identity.rows[0].current_user, 'trademate_app');

    await appClient.query('BEGIN');
    try {
      // Adversarial proof of the known limitation: the actual LOGIN role,
      // without SET ROLE or an application-mediated identity setter, can
      // choose another user's custom GUC and satisfy the current RLS policy.
      await appClient.query("SELECT set_config('app.user_id', $1, true)", [userIds[1]]);
      const visible = await appClient.query(
        'SELECT user_id::text AS user_id, preferences FROM public.user_preferences WHERE user_id = $1',
        [userIds[1]],
      );
      assert.equal(visible.rowCount, 1);
      assert.equal(visible.rows[0].user_id, userIds[1]);
      assert.deepEqual(visible.rows[0].preferences, { fixture: 'other' });
      await appClient.query('COMMIT');
    } catch (error) {
      await appClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    }

    console.log(
      'EXPECTED SECURITY LIMITATION CONFIRMED: direct trademate_app LOGIN can forge app.user_id and read another fixture user under the current pilot policy. Production RLS remains blocked.',
    );
  } finally {
    if (appClient) appClient.release();
    if (appPool) await appPool.end();
    for (const userId of userIds) {
      await admin.query('DELETE FROM public.users WHERE id = $1', [userId]).catch(() => undefined);
    }
    await admin.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Real-login RLS impersonation check failed:', error);
    process.exitCode = 1;
  });
}
