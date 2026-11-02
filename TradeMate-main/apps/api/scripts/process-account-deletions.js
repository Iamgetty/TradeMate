const { Pool } = require('pg');

const connectionString = process.env.WORKER_DATABASE_URL || (process.env.NODE_ENV === 'production' ? '' : process.env.DATABASE_URL);
if (!connectionString) {
  console.error('WORKER_DATABASE_URL is required in production (DATABASE_URL is allowed for local development only).');
  process.exit(1);
}
const execute = process.env.ACCOUNT_DELETION_EXECUTE === 'true';
const legalApproval = process.env.ACCOUNT_DELETION_LEGAL_APPROVAL === 'true';
if (execute && !legalApproval) {
  console.error('Permanent account deletion is blocked. Complete global, jurisdiction-specific legal and records-retention review, then set ACCOUNT_DELETION_LEGAL_APPROVAL=true explicitly.');
  process.exit(1);
}

function reportDatabaseError(context, error) {
  const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
  const severity = typeof error?.severity === 'string' ? error.severity : 'UNKNOWN';
  const rawMessage = typeof error?.message === 'string' ? error.message : 'No error message provided';
  // Never print connection strings, credentials, or URL user-info to workflow logs.
  const safeMessage = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(/(password\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .slice(0, 300);
  console.error(`Account deletion worker database error [${context}]: code=${code} severity=${severity} message=${safeMessage}`);
}

function isRenderInternalDatabaseUrl(value) {
  try {
    return new URL(value).hostname.endsWith('.render.internal');
  } catch {
    return false;
  }
}

// Render's internal PostgreSQL endpoint may present a self-signed certificate.
// Permit that certificate only when explicitly enabled AND the URL is a Render
// internal hostname. TLS encryption remains enabled. External connections
// (including GitHub Actions) continue to verify the server certificate.
const allowRenderInternalSelfSignedCert =
  process.env.WORKER_DATABASE_ALLOW_SELF_SIGNED_INTERNAL_CERT === 'true' &&
  isRenderInternalDatabaseUrl(connectionString);

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'require'
    ? { rejectUnauthorized: !allowRenderInternalSelfSignedCert }
    : undefined,
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
    console.log('Dry run only. Permanent processing remains disabled until global, jurisdiction-specific privacy, financial-record retention, contractual, and dispute-preservation reviews are complete. Then explicitly set both ACCOUNT_DELETION_EXECUTE=true and ACCOUNT_DELETION_LEGAL_APPROVAL=true.');
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
        [item.user_id],
      );
      await client.query(
        "UPDATE user_deletion_requests SET cancellation_token_hash = NULL WHERE user_id = $1",
        [item.user_id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES (NULL, 'account.deletion_processed', 'user', $1, '{\\"method\\":\\"anonymised\\",\\"preserved_commercial_records\\":true}'::jsonb)",
        [item.user_id],
      );
      await client.query('COMMIT');
      console.log(`Processed deletion for user ${item.user_id}.`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      reportDatabaseError('processing deletion', error);
      process.exitCode = 1;
    } finally {
      client.release();
    }
  }
}

main().catch((error) => {
  reportDatabaseError('initial query or connection', error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
