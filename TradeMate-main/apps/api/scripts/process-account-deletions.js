const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}
const execute = process.env.ACCOUNT_DELETION_EXECUTE === 'true';
const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5000,
  max: 2,
});

async function main() {
  const due = await pool.query(
    `SELECT d.user_id, d.scheduled_for
       FROM user_deletion_requests d
       JOIN users u ON u.id = d.user_id
      WHERE d.cancelled_at IS NULL
        AND d.scheduled_for <= now()
        AND u.status = 'deletion_pending'
      ORDER BY d.scheduled_for
      LIMIT 100`,
  );
  console.log(`Found ${due.rowCount} account deletion request(s) due.`);
  if (!execute) {
    console.log('Dry run only. Set ACCOUNT_DELETION_EXECUTE=true after legal and retention approval to process these requests.');
    return;
  }

  for (const item of due.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query(
        `SELECT u.id
           FROM users u
           JOIN user_deletion_requests d ON d.user_id = u.id
          WHERE u.id = $1
            AND u.status = 'deletion_pending'
            AND d.cancelled_at IS NULL
            AND d.scheduled_for <= now()
          FOR UPDATE OF u, d SKIP LOCKED`,
        [item.user_id],
      );
      if (!locked.rowCount) {
        await client.query('ROLLBACK');
        continue;
      }

      // Preserve the user row because commercial records reference it with RESTRICT.
      // Remove login access and ordinary account settings; anonymise the public identity.
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [item.user_id]);
      await client.query('DELETE FROM user_credentials WHERE user_id = $1', [item.user_id]);
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [item.user_id]);
      await client.query('DELETE FROM user_notifications WHERE user_id = $1', [item.user_id]);
      await client.query('UPDATE support_ticket_messages SET sender_user_id = NULL, sender_type = CASE WHEN sender_type = \'user\' THEN \'system\' ELSE sender_type END WHERE sender_user_id = $1', [item.user_id]);
      await client.query('UPDATE marketplace_contracts SET accepted_by_user_id = NULL WHERE accepted_by_user_id = $1', [item.user_id]);
      await client.query('UPDATE audit_events SET actor_user_id = NULL WHERE actor_user_id = $1', [item.user_id]);
      await client.query(
        `UPDATE users
            SET email = NULL,
                phone_e164 = NULL,
                display_name = 'Deleted user ' || left(id::text, 8),
                preferred_locale = 'en',
                country_code = NULL,
                time_zone = NULL,
                status = 'closed',
                updated_at = now()
          WHERE id = $1 AND status = 'deletion_pending'`,
        [item.user_id],
      );
      await client.query(
        "UPDATE user_deletion_requests SET cancellation_token_hash = NULL WHERE user_id = $1",
        [item.user_id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES (NULL, 'account.deletion_processed', 'user', $1, '{\"method\":\"anonymised\",\"preserved_commercial_records\":true}'::jsonb)",
        [item.user_id],
      );
      await client.query('COMMIT');
      console.log(`Processed deletion for user ${item.user_id}.`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error(`Failed to process deletion for user ${item.user_id}:`, error);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }
}

main().catch((error) => {
  console.error('Account deletion worker failed:', error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
