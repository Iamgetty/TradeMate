const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

const connectionString = process.env.ACCOUNT_DELETION_TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error('ACCOUNT_DELETION_TEST_DATABASE_URL is required; this test never falls back to DATABASE_URL.');
}

const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));
if (!/(?:^|[_-])test(?:$|[_-])|_test$/i.test(databaseName)) {
  throw new Error('Refusing account-deletion worker integration test: database name must clearly identify a test database.');
}

const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });

async function main() {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    const identity = await client.query(
      `SELECT current_database() AS database_name, r.rolsuper
         FROM pg_roles r
        WHERE r.rolname = current_user`,
    );
    if (!identity.rows[0]?.rolsuper) {
      throw new Error('Account-deletion worker integration test requires a disposable PostgreSQL superuser to SET ROLE safely.');
    }

    const fixtureId = randomUUID();
    await client.query('BEGIN');
    transactionOpen = true;

    const user = await client.query(
      `INSERT INTO public.users (id, email, display_name, status)
       VALUES ($1, $2, 'Deletion worker fixture', 'deletion_pending')
       RETURNING id`,
      [fixtureId, `deletion-worker-${fixtureId}@example.invalid`],
    );
    const userId = user.rows[0].id;

    const organization = await client.query(
      `INSERT INTO public.organizations (name, organization_type, country_code, default_currency)
       VALUES ('Deletion worker fixture org', 'business', 'NG', 'NGN')
       RETURNING id`,
    );
    const listing = await client.query(
      `INSERT INTO public.listings
         (seller_organization_id, title, description, price_minor_units, currency_code, country_code)
       VALUES ($1, 'Deletion worker fixture listing', 'Disposable fixture', 100, 'NGN', 'NG')
       RETURNING id`,
      [organization.rows[0].id],
    );
    await client.query(
      `INSERT INTO public.marketplace_contracts
         (listing_id, buyer_user_id, seller_organization_id, title, scope, terms,
          amount_minor_units, currency_code, accepted_by_user_id, status)
       VALUES ($1, $2, $3, 'Fixture contract', 'Fixture scope', 'Fixture terms',
               100, 'NGN', $2, 'accepted')`,
      [listing.rows[0].id, userId, organization.rows[0].id],
    );

    await client.query(
      `INSERT INTO public.user_deletion_requests
         (user_id, cancellation_token_hash, requested_at, scheduled_for)
       VALUES ($1, 'fixture-cancellation-hash', now() - interval '2 days', now() - interval '1 day')`,
      [userId],
    );
    await client.query(
      `INSERT INTO public.user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, 'fixture-session-' || $1::text, now() + interval '1 day')`,
      [userId],
    );
    await client.query(
      `INSERT INTO public.user_credentials (user_id, password_hash)
       VALUES ($1, 'fixture-password-hash')`,
      [userId],
    );
    await client.query('INSERT INTO public.user_preferences (user_id) VALUES ($1)', [userId]);
    await client.query(
      `INSERT INTO public.user_notifications (user_id, category, title)
       VALUES ($1, 'System', 'Deletion worker fixture')`,
      [userId],
    );
    const ticket = await client.query(
      `INSERT INTO public.support_tickets (user_id, category, subject)
       VALUES ($1, 'account', 'Deletion worker fixture')
       RETURNING id`,
      [userId],
    );
    const message = await client.query(
      `INSERT INTO public.support_ticket_messages (ticket_id, sender_user_id, sender_type, message)
       VALUES ($1, $2, 'user', 'Fixture support message')
       RETURNING id`,
      [ticket.rows[0].id, userId],
    );

    await client.query('SAVEPOINT deletion_worker_execution');
    await client.query('SET LOCAL ROLE trademate_worker');

    const due = await client.query(
      `SELECT d.user_id, d.scheduled_for
         FROM user_deletion_requests d
         JOIN users u ON u.id = d.user_id
        WHERE d.cancelled_at IS NULL
          AND d.scheduled_for <= now()
          AND u.status = 'deletion_pending'
        ORDER BY d.scheduled_for
        LIMIT 100`,
    );
    if (!due.rows.some((row) => row.user_id === userId)) {
      throw new Error('Worker role could not discover the due fixture request.');
    }

    const locked = await client.query(
      `SELECT u.id
         FROM users u
         JOIN user_deletion_requests d ON d.user_id = u.id
        WHERE u.id = $1
          AND u.status = 'deletion_pending'
          AND d.cancelled_at IS NULL
          AND d.scheduled_for <= now()
        FOR UPDATE OF u, d SKIP LOCKED`,
      [userId],
    );
    if (locked.rowCount !== 1) throw new Error('Worker role could not lock the due user and deletion-request rows.');

    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_credentials WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_notifications WHERE user_id = $1', [userId]);
    await client.query(
      `UPDATE support_ticket_messages
          SET sender_user_id = NULL,
              sender_type = CASE WHEN sender_type = 'user' THEN 'system' ELSE sender_type END
        WHERE sender_user_id = $1`,
      [userId],
    );
    await client.query(
      'UPDATE marketplace_contracts SET accepted_by_user_id = NULL WHERE accepted_by_user_id = $1',
      [userId],
    );
    await client.query(
      `UPDATE users
          SET email = 'deleted+' || id::text || '@deleted.invalid',
              phone_e164 = NULL,
              display_name = 'Deleted user ' || left(id::text, 8),
              preferred_locale = 'en',
              country_code = NULL,
              time_zone = NULL,
              status = 'closed',
              updated_at = now()
        WHERE id = $1 AND status = 'deletion_pending'`,
      [userId],
    );
    await client.query(
      'UPDATE user_deletion_requests SET cancellation_token_hash = NULL WHERE user_id = $1',
      [userId],
    );
    await client.query(
      `INSERT INTO audit_events
         (actor_user_id, event_type, entity_type, entity_id, metadata)
       VALUES (NULL, 'account.deletion_processed', 'user', $1,
               '{"method":"anonymised","preserved_commercial_records":true}'::jsonb)`,
      [userId],
    );

    await client.query('RESET ROLE');
    const result = await client.query(
      `SELECT u.status, u.email, u.display_name,
              d.cancellation_token_hash,
              (SELECT count(*) FROM user_sessions WHERE user_id = u.id) AS sessions,
              (SELECT count(*) FROM user_credentials WHERE user_id = u.id) AS credentials,
              (SELECT count(*) FROM user_preferences WHERE user_id = u.id) AS preferences,
              (SELECT count(*) FROM user_notifications WHERE user_id = u.id) AS notifications,
              (SELECT count(*) FROM support_ticket_messages WHERE id = $2
                 AND sender_user_id IS NULL AND sender_type = 'system') AS anonymised_messages,
              (SELECT count(*) FROM marketplace_contracts
                WHERE buyer_user_id = u.id AND accepted_by_user_id IS NULL) AS preserved_contracts,
              (SELECT count(*) FROM audit_events
                WHERE entity_id = u.id AND event_type = 'account.deletion_processed') AS audit_events
         FROM users u
         JOIN user_deletion_requests d ON d.user_id = u.id
        WHERE u.id = $1`,
      [userId, message.rows[0].id],
    );
    const state = result.rows[0];
    if (
      state.status !== 'closed' ||
      state.email !== `deleted+${userId}@deleted.invalid` ||
      state.display_name !== `Deleted user ${userId.slice(0, 8)}` ||
      state.cancellation_token_hash !== null ||
      ['sessions', 'credentials', 'preferences', 'notifications'].some((key) => Number(state[key]) !== 0) ||
      Number(state.anonymised_messages) !== 1 ||
      Number(state.preserved_contracts) !== 1 ||
      Number(state.audit_events) !== 1
    ) {
      throw new Error(`Worker transaction produced an unexpected fixture state: ${JSON.stringify(state)}`);
    }

    await client.query('ROLLBACK TO SAVEPOINT deletion_worker_execution');
    await client.query('ROLLBACK');
    transactionOpen = false;
    console.log('Account-deletion worker SQL executed successfully as trademate_worker; fixture transaction rolled back.');
  } finally {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Account-deletion worker integration test failed:', error.message);
  process.exitCode = 1;
});
