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

    const verifiedPasswordHash = 'argon2id$verified-login-test-password-hash';
    await admin.query(
      "UPDATE public.users SET email_verified_at = now() WHERE id = $1",
      [userIds[1]],
    );
    await admin.query(
      'INSERT INTO public.user_credentials (user_id, password_hash) VALUES ($1, $2)',
      [userIds[1], verifiedPasswordHash],
    );

    const wrongCredentialSession = await appClient.query(
      'SELECT trademate_private.issue_password_login_session($1, $2, $3, now() + interval \'10 minutes\', $4, $5) AS session_id',
      [userIds[1], 'argon2id$not-the-verified-password-hash', createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.10', 'TradeMate security integration test'],
    );
    assert.equal(wrongCredentialSession.rows[0].session_id, null, 'A stale or incorrect verified hash must not issue a session.');

    const crossAccountLoginTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const crossAccountLogin = await appClient.query(
      'SELECT trademate_private.issue_password_login_session($1, $2, $3, now() + interval \'10 minutes\', $4, $5) AS session_id',
      [userIds[0], verifiedPasswordHash, crossAccountLoginTokenHash, '192.0.2.10', 'TradeMate security integration test'],
    );
    assert.equal(crossAccountLogin.rows[0].session_id, null, 'A verified password hash must never authorize a different account.');

    const issuedLoginTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const issuedLogin = await appClient.query(
      'SELECT trademate_private.issue_password_login_session($1, $2, $3, now() + interval \'10 minutes\', $4, $5) AS session_id',
      [userIds[1], verifiedPasswordHash, issuedLoginTokenHash, '192.0.2.10', 'TradeMate security integration test'],
    );
    assert.ok(issuedLogin.rows[0].session_id, 'A matching verified credential must issue a session.');
    sessionIds.push(issuedLogin.rows[0].session_id);
    sessionHashes.push(issuedLoginTokenHash);
    const issuedLoginAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.login_succeeded' AND entity_id = $1",
      [userIds[1]],
    );
    assert.equal(issuedLoginAudit.rowCount, 1, 'Session issuance must append its login audit event atomically.');
    assert.equal(issuedLoginAudit.rows[0].actor_id, userIds[1]);
    const issuedLoginNotification = await admin.query(
      "SELECT id FROM public.user_notifications WHERE user_id = $1 AND title = 'New sign-in'",
      [userIds[1]],
    );
    assert.equal(issuedLoginNotification.rowCount, 1, 'Session issuance must append its sign-in notification atomically.');

    // The narrow resolver returns an identity, never the presented credential.
    // Password-login session issuance now also runs through its scoped DB operation;
    // unrelated legacy grants remain in place until every auth path is migrated.
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

    const secondaryToken = randomBytes(32).toString('hex');
    const secondaryHash = createHash('sha256').update(secondaryToken).digest('hex');
    const secondarySession = await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes') RETURNING id::text AS id",
      [userIds[1], secondaryHash],
    );
    sessionIds.push(secondarySession.rows[0].id);
    sessionHashes.push(secondaryHash);

    const listed = await appClient.query(
      'SELECT session_id::text AS id, is_current FROM trademate_private.list_presented_user_sessions($1)',
      [sessionHashes[1]],
    );
    assert.equal(listed.rowCount, 3, 'Session listing must include only the authenticated user’s active sessions.');
    assert.equal(listed.rows.filter((row) => row.is_current).length, 1);
    assert.ok(listed.rows.every((row) => [sessionIds[1], sessionIds[2], secondarySession.rows[0].id].includes(row.id)));

    const crossAccountRevoke = await appClient.query(
      'SELECT revoked_session_id FROM trademate_private.revoke_presented_user_session($1, $2)',
      [sessionHashes[1], sessionIds[0]],
    );
    assert.equal(crossAccountRevoke.rowCount, 0, 'A user must not revoke another account’s session.');
    const crossAccountStillExists = await admin.query(
      'SELECT id FROM public.user_sessions WHERE id = $1',
      [sessionIds[0]],
    );
    assert.equal(crossAccountStillExists.rowCount, 1);

    const revoked = await appClient.query(
      'SELECT revoked_session_id::text AS id, revoked_user_id::text AS user_id, was_current FROM trademate_private.revoke_presented_user_session($1, $2)',
      [sessionHashes[1], secondarySession.rows[0].id],
    );
    assert.equal(revoked.rowCount, 1);
    assert.equal(revoked.rows[0].id, secondarySession.rows[0].id);
    assert.equal(revoked.rows[0].user_id, userIds[1]);
    assert.equal(revoked.rows[0].was_current, false);
    const revokeAudit = await admin.query(
      "SELECT metadata FROM public.audit_events WHERE event_type = 'auth.session_revoked' AND entity_id = $1",
      [secondarySession.rows[0].id],
    );
    assert.equal(revokeAudit.rowCount, 1, 'Session revocation must append its audit event atomically.');
    assert.deepEqual(revokeAudit.rows[0].metadata, { current: false });

    const logout = await appClient.query(
      'SELECT logged_out_user_id::text AS user_id FROM trademate_private.logout_presented_session($1)',
      [sessionHashes[0]],
    );
    assert.equal(logout.rowCount, 1, 'A valid presented session can log out.');
    assert.equal(logout.rows[0].user_id, userIds[0]);
    const loggedOutSession = await admin.query(
      'SELECT id FROM public.user_sessions WHERE id = $1',
      [sessionIds[0]],
    );
    assert.equal(loggedOutSession.rowCount, 0, 'Logout must delete the presented session.');
    const logoutAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id, entity_id::text AS entity_id FROM public.audit_events WHERE event_type = 'auth.logout' AND entity_id = $1",
      [userIds[0]],
    );
    assert.equal(logoutAudit.rowCount, 1, 'Logout must append exactly one audit event.');
    assert.equal(logoutAudit.rows[0].actor_id, userIds[0]);

    const invalidLogout = await appClient.query(
      'SELECT logged_out_user_id FROM trademate_private.logout_presented_session($1)',
      ['not-a-sha256-digest'],
    );
    assert.equal(invalidLogout.rowCount, 0, 'Malformed logout digests must not revoke a session.');

    const victimToken = randomBytes(32).toString('hex');
    const victimHash = createHash('sha256').update(victimToken).digest('hex');
    await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [userIds[0], victimHash],
    );

    const additionalToken = randomBytes(32).toString('hex');
    const additionalHash = createHash('sha256').update(additionalToken).digest('hex');
    const additionalSession = await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes') RETURNING id::text AS id",
      [userIds[1], additionalHash],
    );
    sessionIds.push(additionalSession.rows[0].id);
    sessionHashes.push(additionalHash);

    const revokedOthers = await appClient.query(
      'SELECT trademate_private.revoke_other_presented_sessions($1) AS revoked_count',
      [sessionHashes[1]],
    );
    assert.equal(Number(revokedOthers.rows[0].revoked_count), 1, 'Password-change revocation must remove every other active session.');
    const retainedCurrent = await admin.query(
      'SELECT id FROM public.user_sessions WHERE token_hash = $1',
      [sessionHashes[1]],
    );
    assert.equal(retainedCurrent.rowCount, 1, 'The session that presented the authenticated digest must remain active.');
    const removedOther = await admin.query(
      'SELECT id FROM public.user_sessions WHERE id = $1',
      [additionalSession.rows[0].id],
    );
    assert.equal(removedOther.rowCount, 0, 'Other sessions for the authenticated account must be revoked.');
    const sessionsRevokedAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id, metadata FROM public.audit_events WHERE event_type = 'auth.sessions_revoked' AND entity_id = $1",
      [userIds[1]],
    );
    assert.equal(sessionsRevokedAudit.rowCount, 1, 'Bulk session revocation must append one audit event.');
    assert.equal(sessionsRevokedAudit.rows[0].actor_id, userIds[1]);
    assert.deepEqual(sessionsRevokedAudit.rows[0].metadata, { reason: 'password_changed', revoked_count: 1 });

    const victimSessionBeforeBulkRevoke = await admin.query(
      'SELECT id FROM public.user_sessions WHERE token_hash = $1',
      [victimHash],
    );
    assert.equal(victimSessionBeforeBulkRevoke.rowCount, 1);

    const crossAccountBulkRevoke = await appClient.query(
      'SELECT trademate_private.revoke_other_presented_sessions($1) AS revoked_count',
      [victimHash],
    );
    assert.equal(Number(crossAccountBulkRevoke.rows[0].revoked_count), 0, 'A presented session for another account must never authorize bulk revocation.');
    const victimSessionAfterBulkRevoke = await admin.query(
      'SELECT id FROM public.user_sessions WHERE token_hash = $1',
      [victimHash],
    );
    assert.equal(victimSessionAfterBulkRevoke.rowCount, 1, 'Cross-account bulk revocation must leave the victim session intact.');

    const invalidBulkRevoke = await appClient.query(
      'SELECT trademate_private.revoke_other_presented_sessions($1) AS revoked_count',
      ['not-a-sha256-digest'],
    );
    assert.equal(Number(invalidBulkRevoke.rows[0].revoked_count), 0, 'Malformed digests must not revoke sessions.');

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

    await admin.query(
      'UPDATE public.user_credentials SET password_hash = $2 WHERE user_id = $1',
      [userIds[1], 'previous-test-password-hash-value'],
    );
    const resetToken = randomBytes(32).toString('base64url');
    const resetHash = createHash('sha256').update(resetToken).digest('hex');
    await admin.query(
      "INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [userIds[1], resetHash],
    );
    const completedReset = await appClient.query(
      'SELECT reset_user_id::text AS user_id, reset_email AS email FROM trademate_private.complete_password_reset($1, $2)',
      [resetHash, 'argon2id$test-only-new-password-hash-value'],
    );
    assert.equal(completedReset.rowCount, 1, 'A valid reset token must complete the password reset.');
    assert.equal(completedReset.rows[0].user_id, userIds[1]);
    assert.equal(completedReset.rows[0].email, `rls-login-other-${suffix}@example.invalid`);
    const resetCredential = await admin.query(
      'SELECT password_hash FROM public.user_credentials WHERE user_id = $1',
      [userIds[1]],
    );
    assert.equal(resetCredential.rows[0].password_hash, 'argon2id$test-only-new-password-hash-value');
    const remainingResetSessions = await admin.query(
      'SELECT id FROM public.user_sessions WHERE user_id = $1',
      [userIds[1]],
    );
    assert.equal(remainingResetSessions.rowCount, 0, 'Password reset must revoke every session for the account.');
    const consumedReset = await admin.query(
      'SELECT used_at FROM public.password_reset_tokens WHERE token_hash = $1',
      [resetHash],
    );
    assert.ok(consumedReset.rows[0].used_at, 'Password reset must consume its one-time token.');
    const resetAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.password_reset_completed' AND entity_id = $1",
      [userIds[1]],
    );
    assert.equal(resetAudit.rowCount, 1, 'Password reset must append its audit event atomically.');
    assert.equal(resetAudit.rows[0].actor_id, userIds[1]);
    const replayedReset = await appClient.query(
      'SELECT reset_user_id FROM trademate_private.complete_password_reset($1, $2)',
      [resetHash, 'argon2id$another-test-only-password-hash'],
    );
    assert.equal(replayedReset.rowCount, 0, 'A consumed password-reset token must not be reusable.');
    const malformedReset = await appClient.query(
      'SELECT reset_user_id FROM trademate_private.complete_password_reset($1, $2)',
      ['not-a-sha256-digest', 'argon2id$another-test-only-password-hash'],
    );
    assert.equal(malformedReset.rowCount, 0, 'Malformed reset digests must not update credentials.');

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
