const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function expectConstraintFailure(client, query, values, message) {
  await client.query('SAVEPOINT expected_constraint_failure');
  try {
    await assert.rejects(
      client.query(query, values),
      (error) => error.code === '23514',
      message,
    );
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_constraint_failure');
    await client.query('RELEASE SAVEPOINT expected_constraint_failure');
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const suffix = randomUUID();
    const candidate = await client.query(
      "INSERT INTO sports_transfer_data_sources (source_key, display_name, source_type) VALUES ($1, 'Candidate sports source', 'licensed_sports_data') RETURNING id, rights_status, contact_data_permission",
      ['candidate-' + suffix],
    );
    assert.equal(candidate.rows[0].rights_status, 'candidate');
    assert.equal(candidate.rows[0].contact_data_permission, 'not_approved');

    await expectConstraintFailure(
      client,
      "UPDATE sports_transfer_data_sources SET rights_status='approved' WHERE id=$1",
      [candidate.rows[0].id],
      'a source cannot be approved without a documented rights basis, terms and reviewer',
    );
    await client.query('ROLLBACK');
    await client.query('BEGIN');
    const user = await client.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Discovery schema reviewer', 'active') RETURNING id",
      ['discovery-review-' + suffix + '@example.invalid'],
    );

    const approved = await client.query(
      `INSERT INTO sports_transfer_data_sources
        (source_key, display_name, source_type, rights_status, rights_basis, terms_reference,
         permitted_data_categories, permitted_purposes, coverage_sports, reviewed_by_user_id, reviewed_at)
       VALUES ($1, 'Approved football data source', 'licensed_sports_data', 'approved',
         'Written license permits football player identity and availability data for discovery.',
         'license-reference-' || $1,
         ARRAY['player_identity','sporting_profile','availability_status'],
         ARRAY['player_discovery','availability_monitoring'],
         ARRAY['football'], $2, now())
       RETURNING id`,
      ['approved-' + suffix, user.rows[0].id],
    );
    const record = await client.query(
      `INSERT INTO sports_transfer_external_player_records
        (data_source_id, sport, external_player_key, display_name, availability_status,
         source_record_url, confidence_score)
       VALUES ($1, 'football', $2, 'Example Free Agent', 'free_agent_reported',
         'https://source.example/player/1', 0.82)
       RETURNING id, review_status, claim_status`,
      [approved.rows[0].id, 'player-' + suffix],
    );
    assert.equal(record.rows[0].review_status, 'pending_review');
    assert.equal(record.rows[0].claim_status, 'unclaimed');

    const reviewerCandidate = await client.query(
      "INSERT INTO sports_transfer_data_sources (source_key, display_name, source_type) VALUES ($1, 'Reviewer-key source', 'official_league') RETURNING id",
      ['review-key-' + suffix],
    );
    await client.query(
      `UPDATE sports_transfer_data_sources
       SET rights_status='approved', rights_basis='Written terms permit sporting player discovery.',
           terms_reference='review-key-license', permitted_data_categories=ARRAY['player_identity','availability_status'],
           permitted_purposes=ARRAY['player_discovery'], reviewed_at=now(), reviewer_key_id='review-key-test'
       WHERE id=$1`,
      [reviewerCandidate.rows[0].id],
    );
    const reviewerSource = await client.query(
      'SELECT rights_status, reviewer_key_id FROM sports_transfer_data_sources WHERE id=$1',
      [reviewerCandidate.rows[0].id],
    );
    assert.equal(reviewerSource.rows[0].rights_status, 'approved');
    assert.equal(reviewerSource.rows[0].reviewer_key_id, 'review-key-test');

    await client.query(
      `UPDATE sports_transfer_external_player_records
       SET review_status='approved', reviewed_at=now(), reviewer_key_id='review-key-test'
       WHERE id=$1`,
      [record.rows[0].id],
    );
    const reviewedRecord = await client.query(
      'SELECT review_status, reviewer_key_id FROM sports_transfer_external_player_records WHERE id=$1',
      [record.rows[0].id],
    );
    assert.equal(reviewedRecord.rows[0].review_status, 'approved');
    assert.equal(reviewedRecord.rows[0].reviewer_key_id, 'review-key-test');

    await expectConstraintFailure(
      client,
      `INSERT INTO sports_transfer_external_player_records
        (data_source_id, sport, external_player_key, display_name, availability_status)
       VALUES ($1, 'football', $2, 'Invalid Cross Sport Status', 'trade_available_reported')`,
      [approved.rows[0].id, 'invalid-' + suffix],
      'football records cannot use basketball availability states',
    );

    await expectConstraintFailure(
      client,
      `INSERT INTO sports_transfer_external_player_records
        (data_source_id, sport, external_player_key, display_name, review_status)
       VALUES ($1, 'football', $2, 'Unreviewed Public Player', 'approved')`,
      [approved.rows[0].id, 'unreviewed-' + suffix],
      'a discovered player cannot be approved without a reviewer and timestamp',
    );

    const columns = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='sports_transfer_external_player_records'`,
    );
    const columnNames = columns.rows.map(row => row.column_name);
    assert.ok(!columnNames.some(name => /email|phone|mobile|contact/i.test(name)),
      'external player discovery records must not store personal contact details');

    await client.query('ROLLBACK');
    console.log('Sports Transfer external player discovery schema tests passed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Sports Transfer external player discovery schema test failed:', error);
  process.exitCode = 1;
});
