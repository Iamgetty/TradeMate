const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { Pool } = require('pg');

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function main() {
  const connectionString = process.env.RLS_PILOT_TEST_DATABASE_URL;
  if (!connectionString) throw new Error('RLS_PILOT_TEST_DATABASE_URL is required.');
  const admin = new Pool({ connectionString, max: 1 });
  const suffix = randomUUID();
  const ids = [];
  const appPassword = randomBytes(32).toString('hex');
  let appPool;
  let app;
  try {
    await admin.query(`ALTER ROLE trademate_app PASSWORD '${appPassword}'`);
    const appUrl = new URL(connectionString);
    appUrl.username = 'trademate_app';
    appUrl.password = appPassword;
    appPool = new Pool({ connectionString: appUrl.toString(), max: 1 });
    app = await appPool.connect();
    const identity = await app.query('SELECT session_user');
    assert.equal(identity.rows[0].session_user, 'trademate_app');

    const pending = await admin.query(
      "INSERT INTO public.users (email, display_name, status) VALUES ($1, 'Lifecycle pending', 'pending') RETURNING id::text AS id",
      [`lifecycle-pending-${suffix}@example.invalid`],
    );
    ids.push(pending.rows[0].id);
    const codeHash = digest(randomBytes(32));
    const resent = await app.query(
      'SELECT delivery_email FROM trademate_private.resend_email_verification_code($1, $2)',
      [`lifecycle-pending-${suffix}@example.invalid`, codeHash],
    );
    assert.equal(resent.rowCount, 1);
    assert.equal(resent.rows[0].delivery_email, `lifecycle-pending-${suffix}@example.invalid`);
    const code = await admin.query('SELECT code_hash FROM public.email_verification_codes WHERE user_id = $1', [pending.rows[0].id]);
    assert.equal(code.rows[0].code_hash, codeHash);
    await assert.rejects(
      app.query('INSERT INTO public.email_verification_codes (user_id, code_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\')', [pending.rows[0].id, digest('direct-write')]),
      (error) => error.code === '42501',
      'Runtime role must not insert verification codes directly.',
    );

    const resetUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'Lifecycle reset', 'active', now()) RETURNING id::text AS id",
      [`lifecycle-reset-${suffix}@example.invalid`],
    );
    ids.push(resetUser.rows[0].id);
    const resetHash = digest(randomBytes(32));
    const reset = await app.query(
      'SELECT delivery_email FROM trademate_private.issue_password_reset($1, $2)',
      [`lifecycle-reset-${suffix}@example.invalid`, resetHash],
    );
    assert.equal(reset.rowCount, 1);
    assert.equal(reset.rows[0].delivery_email, `lifecycle-reset-${suffix}@example.invalid`);
    const storedReset = await admin.query('SELECT token_hash FROM public.password_reset_tokens WHERE user_id = $1', [resetUser.rows[0].id]);
    assert.equal(storedReset.rows[0].token_hash, resetHash);
    await assert.rejects(
      app.query('INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'30 minutes\')', [resetUser.rows[0].id, digest('direct-write')]),
      (error) => error.code === '42501',
      'Runtime role must not insert reset tokens directly.',
    );

    const deletionUser = await admin.query(
      "INSERT INTO public.users (email, display_name, status, email_verified_at) VALUES ($1, 'Lifecycle deletion', 'active', now()) RETURNING id::text AS id",
      [`lifecycle-delete-${suffix}@example.invalid`],
    );
    ids.push(deletionUser.rows[0].id);
    const passwordHash = `scrypt$lifecycle-fixture-${suffix}`;
    await admin.query('INSERT INTO public.user_credentials (user_id, password_hash) VALUES ($1, $2)', [deletionUser.rows[0].id, passwordHash]);
    const sessionHash = digest(randomBytes(32));
    await admin.query(
      "INSERT INTO public.user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
      [deletionUser.rows[0].id, sessionHash],
    );
    const cancelHash = digest(randomBytes(32));
    const deletion = await app.query(
      'SELECT delivery_email FROM trademate_private.request_presented_account_deletion($1, $2, $3)',
      [sessionHash, passwordHash, cancelHash],
    );
    assert.equal(deletion.rowCount, 1);
    assert.equal(deletion.rows[0].delivery_email, `lifecycle-delete-${suffix}@example.invalid`);
    const deletedState = await admin.query(
      "SELECT u.status, d.cancellation_token_hash, d.scheduled_for > now() AS scheduled FROM public.users u JOIN public.user_deletion_requests d ON d.user_id = u.id WHERE u.id = $1",
      [deletionUser.rows[0].id],
    );
    assert.equal(deletedState.rows[0].status, 'deletion_pending');
    assert.equal(deletedState.rows[0].cancellation_token_hash, cancelHash);
    assert.equal(deletedState.rows[0].scheduled, true);
    const sessions = await admin.query('SELECT id FROM public.user_sessions WHERE user_id = $1', [deletionUser.rows[0].id]);
    assert.equal(sessions.rowCount, 0);
    await assert.rejects(
      app.query('DELETE FROM public.user_sessions WHERE user_id = $1', [deletionUser.rows[0].id]),
      (error) => error.code === '42501',
      'Runtime role must not delete sessions directly.',
    );
    const audit = await admin.query(
      "SELECT count(*)::int AS n FROM public.audit_events WHERE actor_user_id = $1 AND event_type = 'account.deletion_requested'",
      [deletionUser.rows[0].id],
    );
    assert.equal(audit.rows[0].n, 1);

    const wrongPassword = await app.query(
      'SELECT * FROM trademate_private.request_presented_account_deletion($1, $2, $3)',
      [sessionHash, 'scrypt$wrong-expected-hash', digest(randomBytes(32))],
    );
    assert.equal(wrongPassword.rowCount, 0, 'Deletion must fail closed when the verified password hash is stale.');
    console.log('Auth lifecycle operations passed: scoped token issuance and session-bound deletion; direct runtime writes denied.');
  } finally {
    if (app) app.release();
    if (appPool) await appPool.end();
    for (const id of ids) await admin.query('DELETE FROM public.users WHERE id = $1', [id]).catch(() => undefined);
    await admin.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Auth lifecycle operation check failed:', error);
    process.exitCode = 1;
  });
}
