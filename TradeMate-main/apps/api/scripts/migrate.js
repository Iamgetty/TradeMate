const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const MIGRATIONS = [
  '001_initial_marketplace.sql',
  '002_authentication.sql',
  '003_auth_rate_limits.sql',
  '002_enquiry_messages.sql',
  '004_listing_moderation.sql',
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run database migrations.');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
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
