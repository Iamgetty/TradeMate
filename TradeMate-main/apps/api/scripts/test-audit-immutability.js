const assert = require('node:assert/strict');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the audit immutability test.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? true : undefined, max: 1 });
  const client = await pool.connect();
  try {
    const grants = await client.query(`
      SELECT
        has_table_privilege('trademate_app', 'public.audit_events', 'INSERT') AS app_insert,
        has_table_privilege('trademate_app', 'public.audit_events', 'UPDATE') AS app_update,
        has_table_privilege('trademate_app', 'public.audit_events', 'DELETE') AS app_delete,
        has_table_privilege('trademate_worker', 'public.audit_events', 'INSERT') AS worker_insert,
        has_table_privilege('trademate_worker', 'public.audit_events', 'UPDATE') AS worker_update,
        has_table_privilege('trademate_worker', 'public.audit_events', 'DELETE') AS worker_delete
    `);
    assert.equal(grants.rows[0].app_insert, true);
    assert.equal(grants.rows[0].app_update, false);
    assert.equal(grants.rows[0].app_delete, false);
    assert.equal(grants.rows[0].worker_insert, true);
    assert.equal(grants.rows[0].worker_update, false);
    assert.equal(grants.rows[0].worker_delete, false);

    const triggers = await client.query(
      "SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.audit_events'::regclass AND NOT tgisinternal AND tgname IN ('audit_events_immutable_row', 'audit_events_immutable_truncate')",
    );
    assert.equal(triggers.rowCount, 2);
    assert.ok(triggers.rows.every((trigger) => trigger.tgenabled === 'A'));

    await client.query('SET ROLE trademate_app');
    const inserted = await client.query(
      "INSERT INTO audit_events (event_type, entity_type, metadata) VALUES ('security.test_insert', 'test', '{}'::jsonb) RETURNING id",
    );
    assert.equal(inserted.rowCount, 1);
    await client.query('RESET ROLE');

    const eventId = inserted.rows[0].id;
    await client.query('BEGIN');
    try {
      await client.query('SAVEPOINT before_audit_update');
      await assert.rejects(
        client.query('UPDATE audit_events SET metadata = \'{"changed":true}\'::jsonb WHERE id = $1', [eventId]),
        /audit_events is append-only/i,
      );
      await client.query('ROLLBACK TO SAVEPOINT before_audit_update');

      await client.query('SAVEPOINT before_audit_delete');
      await assert.rejects(
        client.query('DELETE FROM audit_events WHERE id = $1', [eventId]),
        /audit_events is append-only/i,
      );
      await client.query('ROLLBACK TO SAVEPOINT before_audit_delete');

      await client.query('SAVEPOINT before_audit_truncate');
      await assert.rejects(
        client.query('TRUNCATE TABLE audit_events'),
        /audit_events is append-only/i,
      );
      await client.query('ROLLBACK TO SAVEPOINT before_audit_truncate');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }

    console.log('Audit immutability passed: runtime/worker append-only grants and UPDATE/DELETE/TRUNCATE triggers.');
  } finally {
    await client.query('RESET ROLE').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Audit immutability test failed:', error);
  process.exitCode = 1;
});
