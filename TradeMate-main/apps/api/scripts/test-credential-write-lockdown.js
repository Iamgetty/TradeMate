const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const digest = (value) => createHash('sha256').update(value).digest('hex');

// Companion to test-credential-write-operations.js: proves the real runtime
// LOGIN can no longer write user_credentials directly, while the scoped
// operations keep registration and password change working.
async function main() {
  const adminConnectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!adminConnectionString) {
    throw new Error('RLS_PILOT_TEST_DATABASE_URL is required for the disposable credential-denial test.');
  }

  const admin = new Pool({ connectionString: adminConnectionString, max: 1 });
  const suffix = randomUUID();
  const userIds = [];
  const appPassword = randomBytes(32).toString('hex');
  let appPool;
  let appClient;

  try {
    await admin.query(`ALTER ROLE trademate_app PASSWORD '${appPassword}'`);
    const appUrl = new URL(adminConnectionString);
    appUrl.username = 'trademate_app';
    appUrl.password = appPassword;
    appPool = new Pool({ connectionString: appUrl.toString(), max: 1 });
    appClient = await appPool.connect();

    const victim = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'Credential denial fixture', 'active', now()) RETURNING id::text AS id",
      [`credential-denial-${suffix}@example.invalid`],
    );
    const victimId = victim.rows[0].id;
    userIds.push(victimId);
    const victimHash = `scrypt$test-only-denial-hash-${suffix}`;
    await admin.query('INSERT INTO public.user_credentials (user_id, password_hash) VALUES ($1, $2)', [victimId, victimHash]);

    const attempts = [
      ['INSERT', 'INSERT INTO public.user_credentials (user_id, password_hash) VALUES ($1, $2)', [randomUUID(), 'scrypt$attacker-controlled-hash-value']],
      ['UPDATE', 'UPDATE public.user_credentials SET password_hash = $2 WHERE user_id = $1', [victimId, 'scrypt$attacker-controlled-hash-value']],
      ['DELETE', 'DELETE FROM public.user_credentials WHERE user_id = $1', [victimId]],
      ['TRUNCATE', 'TRUNCATE public.user_credentials', []],
    ];
    for (const [label, sql, params] of attempts) {
      await assert.rejects(
        appClient.query(sql, params),
        (error) => error.code === '42501',
        `The runtime login must not ${label} public.user_credentials directly.`,
      );
    }
    await assert.rejects(
      appClient.query('SELECT password_hash FROM public.user_credentials WHERE user_id = $1', [victimId]),
      (error) => error.code === '42501',
      'The runtime login must not read password verifiers directly.',
    );

    const intact = await admin.query('SELECT password_hash FROM public.user_credentials WHERE user_id = $1', [victimId]);
    assert.equal(intact.rowCount, 1, 'Denied writes must leave the credential row in place.');
    assert.equal(intact.rows[0].password_hash, victimHash, 'Denied writes must leave the verifier unchanged.');

    // Scoped operations must still work for the same login after the revoke.
    const registered = await appClient.query(
      'SELECT trademate_private.register_password_account($1, $2, $3, $4) AS user_id',
      [`credential-denial-register-${suffix}@example.invalid`, 'Denial register fixture', `scrypt$test-only-post-revoke-hash-${suffix}`, digest('161803')],
    );
    userIds.push(registered.rows[0].user_id);
    assert.ok(registered.rows[0].user_id, 'Registration must keep working without direct table access.');

    const sessionHash = digest(randomBytes(32));
    await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [victimId, sessionHash],
    );
    const changed = await appClient.query(
      'SELECT changed_user_id::text AS user_id FROM trademate_private.change_presented_password($1, $2, $3)',
      [sessionHash, victimHash, `scrypt$test-only-post-revoke-change-${suffix}`],
    );
    assert.equal(changed.rowCount, 1, 'Password change must keep working without direct table access.');
    assert.equal(changed.rows[0].user_id, victimId);

    // Account deletion is performed by the dedicated worker role, not the runtime login.
    const workerCanDelete = await admin.query(
      "SELECT has_table_privilege('trademate_worker', 'public.user_credentials', 'DELETE') AS ok",
    );
    assert.equal(workerCanDelete.rows[0].ok, true, 'The account-deletion worker must retain credential cleanup.');

    console.log('Credential write lockdown passed: trademate_app cannot write user_credentials directly; scoped operations still work.');
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
    console.error('Credential write lockdown check failed:', error);
    process.exitCode = 1;
  });
}
