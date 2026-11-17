const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');

async function expectConstraintFailure(client, sql, values, label) {
  await client.query('SAVEPOINT expected_constraint_failure');
  let failed = false;
  try {
    await client.query(sql, values);
  } catch (error) {
    failed = error.code === '23514' || error.code === '23503' || error.code === '23505' || error.code === '23502';
  }
  await client.query('ROLLBACK TO SAVEPOINT expected_constraint_failure');
  await client.query('RELEASE SAVEPOINT expected_constraint_failure');
  assert.equal(failed, true, label);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Sports Transfer identity integration tests.');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 1,
  });
  const client = await pool.connect();
  try {
    const suffix = randomUUID();
    await client.query('BEGIN');

    const player = (await client.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Sports player test', 'active') RETURNING id",
      ['sports-player-' + suffix + '@example.invalid'],
    )).rows[0].id;
    const representative = (await client.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Sports representative test', 'active') RETURNING id",
      ['sports-representative-' + suffix + '@example.invalid'],
    )).rows[0].id;
    const guardian = (await client.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Sports guardian test', 'active') RETURNING id",
      ['sports-guardian-' + suffix + '@example.invalid'],
    )).rows[0].id;
    const reviewer = (await client.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Sports reviewer test', 'active') RETURNING id",
      ['sports-reviewer-' + suffix + '@example.invalid'],
    )).rows[0].id;

    const profile = (await client.query(
      "INSERT INTO sports_profiles (user_id, sport, display_name, country_code) VALUES ($1, 'football', 'Test player', 'NG') RETURNING id, visibility, verification_status",
      [player],
    )).rows[0];
    assert.equal(profile.visibility, 'private', 'new player profiles must default to private visibility');
    assert.equal(profile.verification_status, 'unverified', 'new player profiles must not appear verified');
    await expectConstraintFailure(
      client,
      "INSERT INTO sports_profiles (user_id, sport, display_name) VALUES ($1, 'football', 'Duplicate profile')",
      [player],
      'a user must not create duplicate profiles for the same sport',
    );
    const basketballProfile = await client.query(
      "INSERT INTO sports_profiles (user_id, sport, display_name) VALUES ($1, 'basketball', 'Test basketball profile') RETURNING id",
      [player],
    );
    assert.ok(basketballProfile.rows[0].id, 'one user may maintain separate profiles for both launch sports');

    const sportsOrg = (await client.query(
      "INSERT INTO sports_organizations (entity_type, legal_name, display_name, country_code, created_by_user_id) VALUES ('club', $1, 'Test Club', 'NG', $2) RETURNING id, verification_status",
      ['Test Club Ltd ' + suffix, player],
    )).rows[0];
    assert.equal(sportsOrg.verification_status, 'unverified', 'new sporting organizations must not appear verified');

    const membership = await client.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id) VALUES ($1, $2, 'recruiter', 'recruitment', 'active', $3) RETURNING id",
      [sportsOrg.id, representative, player],
    );
    assert.ok(membership.rows[0].id, 'scoped sporting-organization membership should be stored');

    const consent = (await client.query(
      "INSERT INTO sports_player_consents (player_profile_id, granted_to_user_id, purpose, scope, expires_at) VALUES ($1, $2, 'negotiation', '{\"competition\":\"test\"}'::jsonb, now() + interval '7 days') RETURNING id, status",
      [profile.id, representative],
    )).rows[0];
    assert.equal(consent.status, 'granted', 'consent state must be explicit');
    await expectConstraintFailure(
      client,
      "INSERT INTO sports_player_consents (player_profile_id, granted_by_user_id, purpose, granted_to_user_id, granted_to_organization_id) VALUES ($1, $2, 'direct_contact', $3, $4)",
      [profile.id, player, representative, sportsOrg.id],
      'a consent grant must target exactly one person or organization',
    );

    const mandate = (await client.query(
      "INSERT INTO sports_representative_mandates (player_profile_id, representative_user_id, mandate_type, permitted_actions, status, verified_by_user_id, verified_at, starts_at, expires_at) VALUES ($1, $2, 'agent', ARRAY['view_profile','negotiate'], 'active', $3, now(), now(), now() + interval '30 days') RETURNING id, status",
      [profile.id, representative, reviewer],
    )).rows[0];
    assert.equal(mandate.status, 'active', 'a mandate can be stored with an explicit verification record');
    await expectConstraintFailure(
      client,
      "INSERT INTO sports_representative_mandates (player_profile_id, mandate_type, permitted_actions, expires_at) VALUES ($1, 'agent', ARRAY['negotiate'], now() + interval '30 days')",
      [profile.id],
      'a mandate must identify exactly one representative person or organization',
    );
    await expectConstraintFailure(
      client,
      "INSERT INTO sports_representative_mandates (player_profile_id, representative_user_id, mandate_type, permitted_actions, expires_at) VALUES ($1, $2, 'agent', ARRAY['admin_all'], now() + interval '30 days')",
      [profile.id, representative],
      'mandate actions must come from the supported allowlist',
    );

    const guardianRecord = (await client.query(
      "INSERT INTO sports_guardian_relationships (player_profile_id, guardian_user_id, relationship_type, verification_status, permitted_actions, verified_by_user_id, verified_at) VALUES ($1, $2, 'legal_guardian', 'verified', ARRAY['safeguarding_contact','approve_contact'], $3, now()) RETURNING id, verification_status",
      [profile.id, guardian, reviewer],
    )).rows[0];
    assert.equal(guardianRecord.verification_status, 'verified');

    const authority = (await client.query(
      "INSERT INTO sports_authority_checks (sports_organization_id, subject_user_id, check_type, status, source_name, checked_by_user_id, checked_at, expires_at) VALUES ($1, $2, 'agent_licence', 'requires_manual_review', 'Manual source review', $3, now(), now() + interval '1 day') RETURNING id, status",
      [sportsOrg.id, representative, reviewer],
    )).rows[0];
    assert.equal(authority.status, 'requires_manual_review', 'the model must allow manual review where automated registries are unavailable');

    const migration = await client.query(
      "SELECT 1 FROM schema_migrations WHERE migration_name = '027_sports_transfer_identity_foundation.sql'",
    );
    assert.equal(migration.rowCount, 1, 'the migration runner must record the Sports Transfer foundation migration');

    await client.query('ROLLBACK');
    console.log('Sports Transfer identity foundation integration tests passed.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Sports Transfer identity integration tests failed:', error);
  process.exitCode = 1;
});
