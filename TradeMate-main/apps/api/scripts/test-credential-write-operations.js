const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function main() {
  const adminConnectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!adminConnectionString) {
    throw new Error('RLS_PILOT_TEST_DATABASE_URL is required for the disposable credential-write test.');
  }

  const admin = new Pool({ connectionString: adminConnectionString, max: 1 });
  const suffix = randomUUID();
  const userIds = [];
  const appPassword = randomBytes(32).toString('hex');
  let appPool;
  let appClient;

  try {
    // Disposable CI database only; the password is random and never persisted.
    await admin.query(`ALTER ROLE trademate_app PASSWORD '${appPassword}'`);
    const appUrl = new URL(adminConnectionString);
    appUrl.username = 'trademate_app';
    appUrl.password = appPassword;
    appPool = new Pool({ connectionString: appUrl.toString(), max: 1 });
    appClient = await appPool.connect();
    const identity = await appClient.query('SELECT session_user, current_user');
    assert.equal(identity.rows[0].session_user, 'trademate_app');
    assert.equal(identity.rows[0].current_user, 'trademate_app');

    // ---- register_password_account ----
    const email = `credential-register-${suffix}@example.invalid`;
    const passwordHash = `scrypt$test-only-registration-hash-${suffix}`;
    const codeHash = digest('314159');
    const registered = await appClient.query(
      'SELECT trademate_private.register_password_account($1, $2, $3, $4) AS user_id',
      [`  ${email.toUpperCase()}  `, '  Credential Fixture  ', passwordHash, codeHash],
    );
    const registeredId = registered.rows[0].user_id;
    assert.ok(registeredId, 'Registration must return the new account id.');
    userIds.push(registeredId);

    const account = await admin.query(
      'SELECT email, display_name, status FROM public.users WHERE id = $1',
      [registeredId],
    );
    assert.equal(account.rows[0].email, email, 'Email must be normalized to lower case without padding.');
    assert.equal(account.rows[0].display_name, 'Credential Fixture');
    assert.equal(account.rows[0].status, 'pending');
    const storedCredential = await admin.query(
      'SELECT password_hash FROM public.user_credentials WHERE user_id = $1',
      [registeredId],
    );
    assert.equal(storedCredential.rows[0].password_hash, passwordHash);
    const storedCode = await admin.query(
      'SELECT code_hash, expires_at > now() AS live FROM public.email_verification_codes WHERE user_id = $1',
      [registeredId],
    );
    assert.equal(storedCode.rowCount, 1);
    assert.equal(storedCode.rows[0].code_hash, codeHash);
    assert.equal(storedCode.rows[0].live, true);
    const registrationAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.email_verification_requested' AND entity_id = $1",
      [registeredId],
    );
    assert.equal(registrationAudit.rowCount, 1, 'Registration must append exactly one audit event atomically.');
    assert.equal(registrationAudit.rows[0].actor_id, registeredId);

    await assert.rejects(
      appClient.query(
        'SELECT trademate_private.register_password_account($1, $2, $3, $4)',
        [email, 'Duplicate Fixture', `scrypt$test-only-duplicate-hash-${suffix}`, digest('271828')],
      ),
      (error) => error.code === '23505',
      'A duplicate email must raise unique_violation so the API can return a conflict.',
    );
    const duplicateLeftovers = await admin.query(
      'SELECT count(*)::int AS n FROM public.user_credentials WHERE password_hash = $1',
      [`scrypt$test-only-duplicate-hash-${suffix}`],
    );
    assert.equal(duplicateLeftovers.rows[0].n, 0, 'A failed registration must leave no partial rows.');

    const invalidRegistrations = [
      ['not-an-email', 'Valid Name', passwordHash, codeHash],
      [`short-name-${suffix}@example.invalid`, 'A', passwordHash, codeHash],
      [`short-hash-${suffix}@example.invalid`, 'Valid Name', 'short', codeHash],
      [`bad-code-${suffix}@example.invalid`, 'Valid Name', passwordHash, 'not-a-digest'],
    ];
    for (const params of invalidRegistrations) {
      await assert.rejects(
        appClient.query('SELECT trademate_private.register_password_account($1, $2, $3, $4)', params),
        (error) => error.code === '22023',
        'Invalid registration parameters must be rejected.',
      );
    }

    // ---- change_presented_password ----
    const activeEmail = `credential-change-${suffix}@example.invalid`;
    const activeUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'Credential change fixture', 'active', now()) RETURNING id::text AS id",
      [activeEmail],
    );
    const activeId = activeUser.rows[0].id;
    userIds.push(activeId);
    const otherUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'Credential bystander fixture', 'active', now()) RETURNING id::text AS id",
      [`credential-bystander-${suffix}@example.invalid`],
    );
    const otherId = otherUser.rows[0].id;
    userIds.push(otherId);

    const currentHash = `scrypt$test-only-current-password-hash-${suffix}`;
    const bystanderHash = `scrypt$test-only-bystander-password-hash-${suffix}`;
    await admin.query('INSERT INTO public.user_credentials (user_id, password_hash) VALUES ($1, $2), ($3, $4)', [
      activeId, currentHash, otherId, bystanderHash,
    ]);

    const presentedHash = digest(randomBytes(32));
    const secondSessionHash = digest(randomBytes(32));
    const bystanderSessionHash = digest(randomBytes(32));
    for (const [id, hash] of [[activeId, presentedHash], [activeId, secondSessionHash], [otherId, bystanderSessionHash]]) {
      await admin.query(
        "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [id, hash],
      );
    }

    const newHash = `scrypt$test-only-new-password-hash-${suffix}`;

    const malformedSession = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      ['not-a-sha256-digest', currentHash, newHash],
    );
    assert.equal(malformedSession.rowCount, 0, 'A malformed session digest must not change any password.');

    const unknownSession = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [digest(randomBytes(32)), currentHash, newHash],
    );
    assert.equal(unknownSession.rowCount, 0, 'An unknown session must not change any password.');

    const crossAccount = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [bystanderSessionHash, currentHash, newHash],
    );
    assert.equal(crossAccount.rowCount, 0, "Another account's verified hash must never authorize a change through this session.");

    const staleExpected = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, `scrypt$test-only-stale-hash-${suffix}`, newHash],
    );
    assert.equal(staleExpected.rowCount, 0, 'A stale expected hash must not overwrite the credential (compare-and-swap).');

    const sameHash = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, currentHash, currentHash],
    );
    assert.equal(sameHash.rowCount, 0, 'Reusing the current hash must be rejected.');

    const untouched = await admin.query(
      'SELECT user_id::text AS user_id, password_hash FROM public.user_credentials WHERE user_id = ANY($1::uuid[]) ORDER BY password_hash',
      [[activeId, otherId]],
    );
    assert.deepEqual(
      untouched.rows.map((row) => row.password_hash).sort(),
      [bystanderHash, currentHash].sort(),
      'Every rejected attempt must leave both credentials unchanged.',
    );

    const changed = await appClient.query(
      'SELECT changed_user_id::text AS user_id, changed_email AS email FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, currentHash, newHash],
    );
    assert.equal(changed.rowCount, 1, 'A valid session and matching expected hash must change the password.');
    assert.equal(changed.rows[0].user_id, activeId);
    assert.equal(changed.rows[0].email, activeEmail);

    const updated = await admin.query(
      'SELECT password_hash FROM public.user_credentials WHERE user_id = $1',
      [activeId],
    );
    assert.equal(updated.rows[0].password_hash, newHash);
    const bystanderAfter = await admin.query(
      'SELECT password_hash FROM public.user_credentials WHERE user_id = $1',
      [otherId],
    );
    assert.equal(bystanderAfter.rows[0].password_hash, bystanderHash, 'Other accounts must be unaffected.');

    const remainingSessions = await admin.query(
      'SELECT token_hash FROM public.user_sessions WHERE user_id = $1',
      [activeId],
    );
    assert.deepEqual(
      remainingSessions.rows.map((row) => row.token_hash),
      [presentedHash],
      'Only the presenting session may survive a password change.',
    );
    const bystanderSession = await admin.query(
      'SELECT id FROM public.user_sessions WHERE token_hash = $1',
      [bystanderSessionHash],
    );
    assert.equal(bystanderSession.rowCount, 1, "Another account's session must survive.");

    const passwordAudit = await admin.query(
      "SELECT actor_user_id::text AS actor_id FROM public.audit_events WHERE event_type = 'auth.password_changed' AND entity_id = $1",
      [activeId],
    );
    assert.equal(passwordAudit.rowCount, 1, 'A password change must append exactly one audit event.');
    assert.equal(passwordAudit.rows[0].actor_id, activeId);
    const revocationAudit = await admin.query(
      "SELECT metadata FROM public.audit_events WHERE event_type = 'auth.sessions_revoked' AND entity_id = $1",
      [activeId],
    );
    assert.equal(revocationAudit.rowCount, 1, 'Revoking other sessions must be audited.');

    const replay = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, currentHash, `scrypt$test-only-replayed-hash-${suffix}`],
    );
    assert.equal(replay.rowCount, 0, 'Replaying the old expected hash must fail after a successful change.');

    await admin.query("UPDATE public.users SET status = 'suspended' WHERE id = $1", [activeId]);
    const suspended = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, newHash, `scrypt$test-only-suspended-hash-${suffix}`],
    );
    assert.equal(suspended.rowCount, 0, 'A suspended account must not change its password.');
    await admin.query("UPDATE public.users SET status = 'active' WHERE id = $1", [activeId]);

    await admin.query("UPDATE public.user_sessions SET expires_at = now() - interval '1 minute' WHERE token_hash = $1", [presentedHash]);
    const expired = await appClient.query(
      'SELECT * FROM trademate_private.change_presented_password($1, $2, $3)',
      [presentedHash, newHash, `scrypt$test-only-expired-hash-${suffix}`],
    );
    assert.equal(expired.rowCount, 0, 'An expired session must not change a password.');

    console.log('Credential write operations passed: registration and password change work through scoped, atomic operations.');
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
    console.error('Credential write operation check failed:', error);
    process.exitCode = 1;
  });
}
