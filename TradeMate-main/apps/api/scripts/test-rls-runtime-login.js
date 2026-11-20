const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function main() {
  const adminConnectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!adminConnectionString) {
    throw new Error('RLS_PILOT_TEST_DATABASE_URL is required for the disposable real-login RLS test.');
  }

  const admin = new Pool({ connectionString: adminConnectionString, max: 1 });
  const suffix = randomUUID();
  const userIds = [];
  const sessionIds = [];
  const sessionHashes = [];
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
      const sessionToken = randomBytes(32).toString('hex');
      const sessionHash = createHash('sha256').update(sessionToken).digest('hex');
      const session = await admin.query(
        "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes') RETURNING id::text AS id",
        [userId, sessionHash],
      );
      sessionIds.push(session.rows[0].id);
      sessionHashes.push(sessionHash);
    }

    const appUrl = new URL(adminConnectionString);
    appUrl.username = 'trademate_app';
    appUrl.password = appPassword;
    appPool = new Pool({ connectionString: appUrl.toString(), max: 1 });
    appClient = await appPool.connect();

    const identity = await appClient.query('SELECT session_user, current_user');
    assert.equal(identity.rows[0].session_user, 'trademate_app');
    assert.equal(identity.rows[0].current_user, 'trademate_app');

    // The new narrow resolver can resolve only a caller-presented digest and
    // returns an identity, never the credential itself. This does not yet
    // remove the legacy direct grants or migrate API call sites.
    const resolved = await appClient.query(
      'SELECT resolved_user_id::text AS user_id FROM trademate_private.resolve_presented_session($1)',
      [sessionHashes[1]],
    );
    assert.equal(resolved.rowCount, 1);
    assert.equal(resolved.rows[0].user_id, userIds[1]);

    await admin.query(
      "UPDATE public.user_sessions SET last_seen_at = now() - interval '5 minutes' WHERE id = $1",
      [sessionIds[1]],
    );
    const touched = await appClient.query(
      'SELECT touched_user_id::text AS user_id FROM trademate_private.touch_presented_session($1)',
      [sessionHashes[1]],
    );
    assert.equal(touched.rowCount, 1, 'A valid presented session can update only its activity marker.');
    assert.equal(touched.rows[0].user_id, userIds[1]);
    const activity = await admin.query(
      'SELECT last_seen_at FROM public.user_sessions WHERE id = $1',
      [sessionIds[1]],
    );
    assert.ok(activity.rows[0].last_seen_at.getTime() > Date.now() - 60_000);

    const malformed = await appClient.query(
      'SELECT resolved_user_id FROM trademate_private.resolve_presented_session($1)',
      ['not-a-sha256-digest'],
    );
    assert.equal(malformed.rowCount, 0);

    await admin.query("UPDATE public.user_sessions SET expires_at = now() - interval '1 minute' WHERE id = $1", [sessionIds[1]]);
    const expired = await appClient.query(
      'SELECT resolved_user_id FROM trademate_private.resolve_presented_session($1)',
      [sessionHashes[1]],
    );
    assert.equal(expired.rowCount, 0, 'Expired sessions must not resolve.');
    const expiredTouch = await appClient.query(
      'SELECT touched_user_id FROM trademate_private.touch_presented_session($1)',
      [sessionHashes[1]],
    );
    assert.equal(expiredTouch.rowCount, 0, 'Expired sessions must not be touchable.');
    await admin.query("UPDATE public.user_sessions SET expires_at = now() + interval '10 minutes' WHERE id = $1", [sessionIds[1]]);

    await admin.query("UPDATE public.users SET status = 'suspended' WHERE id = $1", [userIds[1]]);
    const inactive = await appClient.query(
      'SELECT resolved_user_id FROM trademate_private.resolve_presented_session($1)',
      [sessionHashes[1]],
    );
    assert.equal(inactive.rowCount, 0, 'Inactive accounts must not resolve.');
    await admin.query("UPDATE public.users SET status = 'active' WHERE id = $1", [userIds[1]]);

    // Probe column-level SELECT privileges without retrieving credential
    // values. LIMIT 0 still asks PostgreSQL to authorize every named column,
    // while ensuring no secret material is returned to this test process.
    const credentialColumns = [
      ['user_credentials', 'password_hash'],
      ['user_sessions', 'token_hash'],
      ['user_auth_security', 'totp_secret_encrypted'],
      ['auth_login_challenges', 'token_hash'],
      ['password_reset_tokens', 'token_hash'],
      ['email_verification_codes', 'code_hash'],
      ['user_deletion_requests', 'cancellation_token_hash'],
    ];
    const exposedCredentialColumns = [];
    for (const [table, column] of credentialColumns) {
      try {
        await appClient.query(`SELECT ${column} FROM public.${table} LIMIT 0`);
        exposedCredentialColumns.push(`${table}.${column}`);
      } catch (error) {
        if (error.code !== '42501') throw error;
      }
    }
    assert.deepEqual(
      exposedCredentialColumns,
      credentialColumns.map(([table, column]) => `${table}.${column}`),
      'The current broad runtime grants are expected to expose every inventoried credential column; update this expected-vulnerability test when least-privilege grants land.',
    );

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

      // The role bootstrap currently grants broad SELECT on user_sessions.
      // Prove the real runtime login can disclose another user's bearer-token
      // digest, then place that digest in the caller-settable session context.
      const stolenSession = await appClient.query(
        'SELECT user_id::text AS user_id, token_hash FROM public.user_sessions WHERE user_id = $1',
        [userIds[1]],
      );
      assert.equal(stolenSession.rowCount, 1, 'The current broad grants expose the victim session hash.');
      assert.equal(stolenSession.rows[0].user_id, userIds[1]);
      await appClient.query("SELECT set_config('app.session_token_hash', $1, true)", [stolenSession.rows[0].token_hash]);
      const sessionLookup = await appClient.query(
        'SELECT user_id::text AS user_id FROM public.user_sessions WHERE token_hash = current_setting(\'app.session_token_hash\', true)',
      );
      assert.equal(sessionLookup.rowCount, 1);
      assert.equal(sessionLookup.rows[0].user_id, userIds[1]);
      await appClient.query('COMMIT');
    } catch (error) {
      await appClient.query('ROLLBACK').catch(() => undefined);
      throw error;
    }

    console.log(
      'EXPECTED SECURITY LIMITATIONS CONFIRMED: direct trademate_app LOGIN can forge app.user_id, read another fixture user under the current pilot policy, disclose another user session token hash, use that digest as app.session_token_hash, and SELECT all seven inventoried credential-bearing columns (the column probes return no values). Production RLS remains blocked.',
    );
  } finally {
    if (appClient) appClient.release();
    if (appPool) await appPool.end();
    for (const sessionId of sessionIds) {
      await admin.query('DELETE FROM public.user_sessions WHERE id = $1', [sessionId]).catch(() => undefined);
    }
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
