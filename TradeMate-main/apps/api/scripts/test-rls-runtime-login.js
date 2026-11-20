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

    const pendingEmail = `rls-email-verification-${suffix}@example.invalid`;
    const pendingUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status) VALUES ($1, 'Email verification fixture', 'pending') RETURNING id::text AS id",
      [pendingEmail],
    );
    userIds.push(pendingUser.rows[0].id);
    const emailCodeHash = createHash('sha256').update('482913').digest('hex');
    await admin.query(
      "INSERT INTO public.email_verification_codes (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [pendingUser.rows[0].id, emailCodeHash],
    );
    const invalidEmailSession = await appClient.query(
      'SELECT * FROM trademate_private.complete_email_verification($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [pendingEmail, createHash('sha256').update('000000').digest('hex'), createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.11', 'TradeMate email verification test'],
    );
    assert.equal(invalidEmailSession.rowCount, 0, 'An incorrect email verification code must not activate an account or issue a session.');
    const failedEmailAttempts = await admin.query(
      'SELECT attempts FROM public.email_verification_codes WHERE user_id = $1',
      [pendingUser.rows[0].id],
    );
    assert.equal(failedEmailAttempts.rows[0].attempts, 1, 'An incorrect verification code must consume one attempt.');
    const stillPendingEmailUser = await admin.query(
      "SELECT status, email_verified_at FROM public.users WHERE id = $1",
      [pendingUser.rows[0].id],
    );
    assert.equal(stillPendingEmailUser.rows[0].status, 'pending');
    assert.equal(stillPendingEmailUser.rows[0].email_verified_at, null);

    const emailSessionTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const completedEmailVerification = await appClient.query(
      'SELECT verified_user_id::text AS user_id, verified_email AS email FROM trademate_private.complete_email_verification($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [pendingEmail, emailCodeHash, emailSessionTokenHash, '192.0.2.11', 'TradeMate email verification test'],
    );
    assert.equal(completedEmailVerification.rowCount, 1, 'A valid email code must activate the account and issue a session.');
    assert.equal(completedEmailVerification.rows[0].user_id, pendingUser.rows[0].id);
    assert.equal(completedEmailVerification.rows[0].email, pendingEmail);
    const emailSession = await admin.query(
      'SELECT id::text AS id FROM public.user_sessions WHERE token_hash = $1',
      [emailSessionTokenHash],
    );
    assert.equal(emailSession.rowCount, 1, 'Email verification must create exactly the presented session digest.');
    sessionIds.push(emailSession.rows[0].id);
    sessionHashes.push(emailSessionTokenHash);
    const activatedEmailUser = await admin.query(
      'SELECT status, email_verified_at FROM public.users WHERE id = $1',
      [pendingUser.rows[0].id],
    );
    assert.equal(activatedEmailUser.rows[0].status, 'active');
    assert.ok(activatedEmailUser.rows[0].email_verified_at);
    const emailVerificationAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.email_verified' AND entity_id = $1",
      [pendingUser.rows[0].id],
    );
    assert.equal(emailVerificationAudit.rowCount, 1, 'Email verification must append one audit event atomically.');
    assert.equal(emailVerificationAudit.rows[0].actor_id, pendingUser.rows[0].id);
    const replayedEmailVerification = await appClient.query(
      'SELECT verified_user_id FROM trademate_private.complete_email_verification($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [pendingEmail, emailCodeHash, createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.11', 'TradeMate email verification test'],
    );
    assert.equal(replayedEmailVerification.rowCount, 0, 'A consumed email verification code must not be replayable.');

    const totpUserResult = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'TOTP login fixture', 'active', now()) RETURNING id::text AS id",
      [`rls-totp-login-${suffix}@example.invalid`],
    );
    const totpUserId = totpUserResult.rows[0].id;
    userIds.push(totpUserId);
    await admin.query(
      "INSERT INTO public.user_auth_security (user_id, totp_secret_encrypted, totp_enabled, totp_confirmed_at) VALUES ($1, 'test-only-encrypted-secret-placeholder', true, now())",
      [totpUserId],
    );

    const enrollmentUserResult = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'TOTP enrollment fixture', 'active', now()) RETURNING id::text AS id",
      [`rls-totp-enrollment-${suffix}@example.invalid`],
    );
    const enrollmentUserId = enrollmentUserResult.rows[0].id;
    userIds.push(enrollmentUserId);
    const enrollmentSessionHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [enrollmentUserId, enrollmentSessionHash],
    );
    const foreignEnrollmentRead = await appClient.query(
      'SELECT * FROM trademate_private.resolve_totp_enrollment($1)',
      [sessionHashes[0]],
    );
    assert.equal(foreignEnrollmentRead.rowCount, 0, 'A presented session for another account must never resolve this enrollment secret.');
    const startedEnrollment = await appClient.query(
      'SELECT trademate_private.begin_totp_enrollment($1, $2) AS started',
      [enrollmentSessionHash, 'test-only-encrypted-enrollment-secret'],
    );
    assert.equal(startedEnrollment.rows[0].started, true, 'An active verified account must be able to start TOTP enrollment.');
    const pendingEnrollment = await appClient.query(
      'SELECT encrypted_totp_secret, enrollment_expires_at, last_totp_counter FROM trademate_private.resolve_totp_enrollment($1)',
      [enrollmentSessionHash],
    );
    assert.equal(pendingEnrollment.rowCount, 1);
    assert.equal(pendingEnrollment.rows[0].encrypted_totp_secret, 'test-only-encrypted-enrollment-secret');
    assert.ok(new Date(pendingEnrollment.rows[0].enrollment_expires_at).getTime() > Date.now());
    const enabledEnrollment = await appClient.query(
      'SELECT trademate_private.complete_totp_enrollment($1, $2) AS completed',
      [enrollmentSessionHash, '223456789'],
    );
    assert.equal(enabledEnrollment.rows[0].completed, true, 'A fresh verified TOTP counter must complete enrollment.');
    const enrollmentAudit = await admin.query(
      "SELECT id FROM public.audit_events WHERE event_type = 'auth.totp_enabled' AND entity_id = $1",
      [enrollmentUserId],
    );
    assert.equal(enrollmentAudit.rowCount, 1, 'TOTP enrollment must atomically record its audit event.');
    const duplicateEnrollment = await appClient.query(
      'SELECT trademate_private.begin_totp_enrollment($1, $2) AS started',
      [enrollmentSessionHash, 'test-only-another-encrypted-secret'],
    );
    assert.equal(duplicateEnrollment.rows[0].started, false, 'An enabled authenticator must never be overwritten by setup.');
    const enabledSecret = await appClient.query(
      'SELECT encrypted_totp_secret, last_totp_counter FROM trademate_private.resolve_enabled_totp($1)',
      [enrollmentSessionHash],
    );
    assert.equal(enabledSecret.rowCount, 1);
    assert.equal(enabledSecret.rows[0].encrypted_totp_secret, 'test-only-encrypted-enrollment-secret');
    assert.equal(enabledSecret.rows[0].last_totp_counter.toString(), '223456789');
    const staleDisable = await appClient.query(
      'SELECT trademate_private.disable_totp($1, $2) AS disabled',
      [enrollmentSessionHash, '223456789'],
    );
    assert.equal(staleDisable.rows[0].disabled, false, 'TOTP disable must reject a replayed counter.');
    const disabledTotp = await appClient.query(
      'SELECT trademate_private.disable_totp($1, $2) AS disabled',
      [enrollmentSessionHash, '223456790'],
    );
    assert.equal(disabledTotp.rows[0].disabled, true, 'A fresh verified TOTP counter must disable the authenticator.');
    const disabledSecret = await admin.query(
      'SELECT totp_enabled, totp_secret_encrypted, totp_confirmed_at FROM public.user_auth_security WHERE user_id = $1',
      [enrollmentUserId],
    );
    assert.equal(disabledSecret.rows[0].totp_enabled, false);
    assert.equal(disabledSecret.rows[0].totp_secret_encrypted, null, 'Disabling TOTP must clear the encrypted secret.');
    assert.equal(disabledSecret.rows[0].totp_confirmed_at, null);
    const disableAudit = await admin.query(
      "SELECT id FROM public.audit_events WHERE event_type = 'auth.totp_disabled' AND entity_id = $1",
      [enrollmentUserId],
    );
    assert.equal(disableAudit.rowCount, 1, 'TOTP disable must atomically record its audit event.');
    const disabledResolution = await appClient.query(
      'SELECT * FROM trademate_private.resolve_enabled_totp($1)',
      [enrollmentSessionHash],
    );
    assert.equal(disabledResolution.rowCount, 0, 'Disabled TOTP secrets must no longer be resolvable.');

    const totpChallengeTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.auth_login_challenges (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')",
      [totpUserId, totpChallengeTokenHash],
    );

    const resolvedTotpChallenge = await appClient.query(
      'SELECT challenge_user_id::text AS user_id, challenge_attempts AS attempts, challenge_email AS email, encrypted_totp_secret, last_totp_counter FROM trademate_private.resolve_totp_login_challenge($1)',
      [totpChallengeTokenHash],
    );
    assert.equal(resolvedTotpChallenge.rowCount, 1, 'The runtime must resolve a valid TOTP challenge through the scoped operation.');
    assert.equal(resolvedTotpChallenge.rows[0].user_id, totpUserId);
    assert.equal(resolvedTotpChallenge.rows[0].email, `rls-totp-login-${suffix}@example.invalid`);
    assert.equal(resolvedTotpChallenge.rows[0].encrypted_totp_secret, 'test-only-encrypted-secret-placeholder');
    assert.equal(resolvedTotpChallenge.rows[0].attempts, 0);
    const unknownTotpChallenge = await appClient.query(
      'SELECT * FROM trademate_private.resolve_totp_login_challenge($1)',
      [createHash('sha256').update(randomBytes(32)).digest('hex')],
    );
    assert.equal(unknownTotpChallenge.rowCount, 0, 'Unknown TOTP challenges must not reveal account or secret data.');

    const failedTotpChallengeHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.auth_login_challenges (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')",
      [totpUserId, failedTotpChallengeHash],
    );
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const failedAttempt = await appClient.query(
        'SELECT trademate_private.record_totp_login_failure($1) AS attempts',
        [failedTotpChallengeHash],
      );
      assert.equal(failedAttempt.rows[0].attempts, attempt, 'Failed TOTP attempts must increment atomically and monotonically.');
    }
    const cappedFailure = await appClient.query(
      'SELECT trademate_private.record_totp_login_failure($1) AS attempts',
      [failedTotpChallengeHash],
    );
    assert.equal(cappedFailure.rows[0].attempts, 0, 'TOTP challenge attempts must never exceed the five-attempt limit.');
    const totpSessionTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    const matchedTotpCounter = 123456789n;
    const completedTotpLogin = await appClient.query(
      'SELECT verified_user_id::text AS user_id, verified_email AS email FROM trademate_private.complete_totp_login($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [totpChallengeTokenHash, matchedTotpCounter.toString(), totpSessionTokenHash, '192.0.2.12', 'TradeMate TOTP login test'],
    );
    assert.equal(completedTotpLogin.rowCount, 1, 'A valid, unconsumed TOTP challenge and fresh counter must issue a session.');
    assert.equal(completedTotpLogin.rows[0].user_id, totpUserId);
    assert.equal(completedTotpLogin.rows[0].email, `rls-totp-login-${suffix}@example.invalid`);
    const consumedTotpState = await admin.query(
      'SELECT c.consumed_at, s.last_totp_counter FROM public.auth_login_challenges c JOIN public.user_auth_security s ON s.user_id = c.user_id WHERE c.token_hash = $1',
      [totpChallengeTokenHash],
    );
    assert.ok(consumedTotpState.rows[0].consumed_at, 'Successful TOTP login must consume its challenge.');
    assert.equal(consumedTotpState.rows[0].last_totp_counter.toString(), matchedTotpCounter.toString(), 'Successful TOTP login must atomically advance the replay counter.');
    const totpSession = await admin.query(
      'SELECT id::text AS id FROM public.user_sessions WHERE token_hash = $1',
      [totpSessionTokenHash],
    );
    assert.equal(totpSession.rowCount, 1);
    sessionIds.push(totpSession.rows[0].id);
    sessionHashes.push(totpSessionTokenHash);
    const totpAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.login_succeeded' AND entity_id = $1",
      [totpUserId],
    );
    assert.equal(totpAudit.rowCount, 1, 'TOTP login must append its audit event atomically.');
    assert.equal(totpAudit.rows[0].actor_id, totpUserId);
    const totpNotification = await admin.query(
      "SELECT id FROM public.user_notifications WHERE user_id = $1 AND title = 'New sign-in'",
      [totpUserId],
    );
    assert.equal(totpNotification.rowCount, 1, 'TOTP login must create its sign-in notification atomically.');
    const replayedTotpLogin = await appClient.query(
      'SELECT verified_user_id FROM trademate_private.complete_totp_login($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [totpChallengeTokenHash, (matchedTotpCounter + 1n).toString(), createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.12', 'TradeMate TOTP login test'],
    );
    assert.equal(replayedTotpLogin.rowCount, 0, 'A consumed TOTP challenge must not be replayable, even with a newer counter.');

    const expiredChallengeHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.auth_login_challenges (user_id, token_hash, expires_at) VALUES ($1, $2, now() - interval '1 minute')",
      [totpUserId, expiredChallengeHash],
    );
    const expiredTotpLogin = await appClient.query(
      'SELECT verified_user_id FROM trademate_private.complete_totp_login($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [expiredChallengeHash, (matchedTotpCounter + 1n).toString(), createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.12', 'TradeMate TOTP login test'],
    );
    assert.equal(expiredTotpLogin.rowCount, 0, 'An expired TOTP challenge must not issue a session.');
    const staleCounterHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.auth_login_challenges (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '5 minutes')",
      [totpUserId, staleCounterHash],
    );
    const staleTotpCounter = await appClient.query(
      'SELECT verified_user_id FROM trademate_private.complete_totp_login($1, $2, $3, now() + interval \'10 minutes\', $4, $5)',
      [staleCounterHash, matchedTotpCounter.toString(), createHash('sha256').update(randomBytes(32)).digest('hex'), '192.0.2.12', 'TradeMate TOTP login test'],
    );
    assert.equal(staleTotpCounter.rowCount, 0, 'A TOTP counter that has already been consumed must not issue a session.');

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
    assert.ok(listed.rows.every((row) => [sessionIds[1], sessionIds[4], secondarySession.rows[0].id].includes(row.id)));

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
    assert.equal(Number(revokedOthers.rows[0].revoked_count), 2, 'Password-change revocation must remove every other active session.');
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
    const removedIssuedLogin = await admin.query(
      'SELECT id FROM public.user_sessions WHERE id = $1',
      [sessionIds[4]],
    );
    assert.equal(removedIssuedLogin.rowCount, 0, 'The additional password-login session must also be revoked.');
    const sessionsRevokedAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id, metadata FROM public.audit_events WHERE event_type = 'auth.sessions_revoked' AND entity_id = $1",
      [userIds[1]],
    );
    assert.equal(sessionsRevokedAudit.rowCount, 1, 'Bulk session revocation must append one audit event.');
    assert.equal(sessionsRevokedAudit.rows[0].actor_id, userIds[1]);
    assert.deepEqual(sessionsRevokedAudit.rows[0].metadata, { reason: 'password_changed', revoked_count: 2 });

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
      [],
      'The runtime role must not directly read any inventoried credential-bearing column.',
    );

    await assert.rejects(
      appClient.query('SELECT password_hash FROM public.user_credentials WHERE user_id = $1', [userIds[1]]),
      (error) => error.code === '42501',
      'The runtime role must not directly read password verifiers.',
    );
    const scopedPassword = await appClient.query(
      'SELECT user_id::text AS user_id, password_hash FROM trademate_private.resolve_presented_password_credentials($1)',
      [sessionHashes[1]],
    );
    assert.equal(scopedPassword.rowCount, 1);
    assert.equal(scopedPassword.rows[0].user_id, userIds[1]);
    assert.equal(scopedPassword.rows[0].password_hash, 'argon2id$verified-login-test-password-hash');

    const loginCredentials = await appClient.query(
      'SELECT user_id::text AS user_id, password_hash FROM trademate_private.resolve_password_login_credentials($1)',
      [`rls-login-other-${suffix}@example.invalid`],
    );
    assert.equal(loginCredentials.rowCount, 1);
    assert.equal(loginCredentials.rows[0].user_id, userIds[1]);
    assert.equal(loginCredentials.rows[0].password_hash, 'argon2id$verified-login-test-password-hash');

    await appClient.query('BEGIN');
    try {
      // The real LOGIN role can set arbitrary custom GUCs. A conflicting
      // app.user_id must not change the identity derived from its presented
      // session digest or permit cross-account reads.
      await appClient.query("SELECT set_config('app.session_token_hash', $1, true)", [sessionHashes[0]]);
      await appClient.query("SELECT set_config('app.user_id', $1, true)", [userIds[1]]);
      const forgedIdentity = await appClient.query(
        'SELECT trademate_private.current_presented_user_id()::text AS user_id',
      );
      assert.equal(forgedIdentity.rows[0].user_id, userIds[0]);
      const crossAccountRows = await appClient.query(
        'SELECT user_id::text AS user_id FROM public.user_preferences WHERE user_id = $1',
        [userIds[1]],
      );
      assert.equal(crossAccountRows.rowCount, 0, 'Forged app.user_id must not grant access to another account.');
      const ownAccountRows = await appClient.query(
        'SELECT user_id::text AS user_id, preferences FROM public.user_preferences WHERE user_id = $1',
        [userIds[0]],
      );
      assert.equal(ownAccountRows.rowCount, 1, 'The presented session must retain access to its own private rows.');
      assert.deepEqual(ownAccountRows.rows[0].preferences, { fixture: 'owner' });

      // Session bearer-token digests remain inaccessible to the runtime login.
      await appClient.query('SAVEPOINT session_token_read_probe');
      await assert.rejects(
        appClient.query('SELECT token_hash FROM public.user_sessions WHERE user_id = $1', [userIds[1]]),
        (error) => error.code === '42501',
        'The runtime login must not disclose another account session digest.',
      );
      await appClient.query('ROLLBACK TO SAVEPOINT session_token_read_probe');
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

    const discardedResetHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [userIds[0], discardedResetHash],
    );
    const discardedReset = await appClient.query(
      'SELECT trademate_private.discard_password_reset_token($1) AS discarded',
      [discardedResetHash],
    );
    assert.equal(discardedReset.rows[0].discarded, true, 'A failed-delivery reset token must be removable by its digest.');
    const discardedResetRow = await admin.query(
      'SELECT token_hash FROM public.password_reset_tokens WHERE token_hash = $1',
      [discardedResetHash],
    );
    assert.equal(discardedResetRow.rowCount, 0);
    const replayedDiscard = await appClient.query(
      'SELECT trademate_private.discard_password_reset_token($1) AS discarded',
      [discardedResetHash],
    );
    assert.equal(replayedDiscard.rows[0].discarded, false);

    const deletionRollbackEmail = `rls-deletion-rollback-${suffix}@example.invalid`;
    const deletionRollbackUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status) VALUES ($1, 'Deletion rollback fixture', 'deletion_pending') RETURNING id::text AS id",
      [deletionRollbackEmail],
    );
    userIds.push(deletionRollbackUser.rows[0].id);
    const rollbackTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.user_deletion_requests (user_id, cancellation_token_hash, requested_at, scheduled_for) VALUES ($1, $2, now(), now() + interval '30 days')",
      [deletionRollbackUser.rows[0].id, rollbackTokenHash],
    );
    const rolledBackDeletion = await appClient.query(
      'SELECT trademate_private.rollback_account_deletion_request($1) AS restored',
      [rollbackTokenHash],
    );
    assert.equal(rolledBackDeletion.rows[0].restored, true, 'Failed cancellation-email delivery must roll back the pending deletion atomically.');
    const rollbackStatus = await admin.query(
      'SELECT status FROM public.users WHERE id = $1',
      [deletionRollbackUser.rows[0].id],
    );
    assert.equal(rollbackStatus.rows[0].status, 'active');
    const rollbackAudit = await admin.query(
      "SELECT metadata FROM public.audit_events WHERE event_type = 'account.deletion_request_rolled_back' AND entity_id = $1",
      [deletionRollbackUser.rows[0].id],
    );
    assert.equal(rollbackAudit.rowCount, 1);
    assert.deepEqual(rollbackAudit.rows[0].metadata, { reason: 'notification_delivery_failed' });

    const deletionEmail = `rls-deletion-cancel-${suffix}@example.invalid`;
    const deletionUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status) VALUES ($1, 'Deletion cancellation fixture', 'deletion_pending') RETURNING id::text AS id",
      [deletionEmail],
    );
    userIds.push(deletionUser.rows[0].id);
    const cancellationTokenHash = createHash('sha256').update(randomBytes(32)).digest('hex');
    await admin.query(
      "INSERT INTO public.user_deletion_requests (user_id, cancellation_token_hash, requested_at, scheduled_for) VALUES ($1, $2, now(), now() + interval '30 days')",
      [deletionUser.rows[0].id, cancellationTokenHash],
    );
    const restoredAccount = await appClient.query(
      'SELECT restored_user_id::text AS user_id, restored_email AS email FROM trademate_private.complete_account_deletion_cancellation($1)',
      [cancellationTokenHash],
    );
    assert.equal(restoredAccount.rowCount, 1, 'A valid cancellation token must restore the account.');
    assert.equal(restoredAccount.rows[0].user_id, deletionUser.rows[0].id);
    assert.equal(restoredAccount.rows[0].email, deletionEmail);
    const restoredStatus = await admin.query(
      'SELECT status FROM public.users WHERE id = $1',
      [deletionUser.rows[0].id],
    );
    assert.equal(restoredStatus.rows[0].status, 'active');
    const consumedCancellation = await admin.query(
      'SELECT cancellation_token_hash, cancelled_at FROM public.user_deletion_requests WHERE user_id = $1',
      [deletionUser.rows[0].id],
    );
    assert.equal(consumedCancellation.rows[0].cancellation_token_hash, null);
    assert.ok(consumedCancellation.rows[0].cancelled_at);
    const cancellationAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'account.deletion_cancelled' AND entity_id = $1",
      [deletionUser.rows[0].id],
    );
    assert.equal(cancellationAudit.rowCount, 1, 'Account restoration must append its audit event atomically.');
    const replayedCancellation = await appClient.query(
      'SELECT restored_user_id FROM trademate_private.complete_account_deletion_cancellation($1)',
      [cancellationTokenHash],
    );
    assert.equal(replayedCancellation.rowCount, 0, 'A consumed account deletion cancellation token must not be reusable.');

    console.log(
      'RUNTIME IDENTITY SPOOFING BLOCKED: a direct trademate_app LOGIN cannot use a forged app.user_id to read another account; RLS identity is derived from the presented session digest. All seven inventoried credential-bearing columns are blocked from direct runtime reads. Account-deletion cancellation uses an atomic scoped operation. Production RLS remains blocked.',
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
