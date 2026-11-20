const { readFile, readdir } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const MIGRATIONS = [
  '001_initial_marketplace.sql',
  '002_authentication.sql',
  '003_auth_rate_limits.sql',
  '002_enquiry_messages.sql',
  '004_listing_moderation.sql',
  '002_p2p_market_records.sql',
  '005_marketplace_transactions.sql',
  '006_p2p_order_lifecycle.sql',
  '007_community_feed.sql',
  '008_feed_titles_attachments.sql',
  '008_feed_interactions.sql',
  '009_b2b_listing_type.sql',
  '010_marketplace_contracts.sql',
  '011_organization_documents.sql',
  '012_user_notifications.sql',
  '013_support_feedback.sql',
  '014_user_preferences.sql',
  '015_authenticator_2fa.sql',
  '016_session_device_metadata.sql',
  '017_transactional_email_account_deletion.sql',
  '018_enquiry_read_receipts.sql',
  '019_public_profiles_and_follows.sql',
  '020_immutable_audit_events.sql',
  '021_p2p_public_payment_methods.sql',
  '021_totp_replay_protection.sql',
  '022_password_reset_tokens.sql',
  '023_email_verification.sql',
  '024_usernames.sql',
  '025_ensure_public_profile_rows.sql',
  '026_all_contract_category_review.sql',
  '027_sports_transfer_identity_foundation.sql',
  '028_sports_transfer_mandate_acceptance.sql',
  '029_sports_transfer_opportunity_drafts.sql',
  '030_sports_transfer_external_player_discovery.sql',
  '031_narrow_presented_session_resolver.sql',
  '032_touch_presented_session.sql',
  '033_presented_session_management.sql',
  '034_logout_presented_session.sql',
];

async function main() {
  const migrationsDirectory = path.join(__dirname, '..', 'database', 'migrations');
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const registeredMigrations = [...MIGRATIONS].sort();
  const unregistered = migrationFiles.filter((file) => !registeredMigrations.includes(file));
  const missingFiles = registeredMigrations.filter((file) => !migrationFiles.includes(file));
  if (unregistered.length || missingFiles.length) {
    throw new Error(
      `Migration manifest mismatch. Unregistered files: [${unregistered.join(', ')}]. Missing files: [${missingFiles.join(', ')}].`,
    );
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const migrationDatabaseUrl = isProduction
    ? process.env.MIGRATION_DATABASE_URL
    : (process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  if (!migrationDatabaseUrl) {
    throw new Error(isProduction
      ? 'MIGRATION_DATABASE_URL is required in production; refusing to run migrations with the runtime DATABASE_URL role.'
      : 'MIGRATION_DATABASE_URL (or DATABASE_URL for local development) is required to run database migrations.');
  }

  const pool = new Pool({
    connectionString: migrationDatabaseUrl,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    connectionTimeoutMillis: 10000,
    max: 1,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7319042026)');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    for (const migrationName of MIGRATIONS) {
      const existing = await client.query(
        'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
        [migrationName],
      );

      if (existing.rowCount > 0) {
        console.log(`Migration already applied: ${migrationName}`);
        continue;
      }

      const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationName);
      const sql = await readFile(migrationPath, 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (migration_name) VALUES ($1)',
        [migrationName],
      );
      console.log(`Migration applied successfully: ${migrationName}`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
});
