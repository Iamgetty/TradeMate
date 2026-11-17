const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = token => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  process.env.TRADEMATE_REVIEW_API_KEY = 'sports-discovery-test-review-key';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  let app;
  try {
    const suffix = randomUUID();
    const user = await pool.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, 'Discovery API test user', 'active') RETURNING id",
      ['sports-discovery-api-' + suffix + '@example.invalid'],
    );
    const token = 'sports-discovery-api-' + suffix;
    await pool.query(
      "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '10 minutes')",
      [user.rows[0].id, tokenHash(token)],
    );

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
    const review = (method, path, body, key = true) => fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'x-review-key': process.env.TRADEMATE_REVIEW_API_KEY } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const unauthorized = await review('GET', '/api/moderation/sports-transfer/sources', null, false);
    assert.equal(unauthorized.status, 401, 'review routes require the configured review key');

    const created = await review('POST', '/api/moderation/sports-transfer/sources', {
      sourceKey: 'api-test-' + suffix,
      displayName: 'API Test League Feed',
      sourceType: 'official_league',
      accessMethod: 'manual_review',
      coverageSports: ['football'],
      coverageCountryCodes: ['NG'],
    });
    assert.equal(created.status, 201);
    const source = (await created.json()).source;
    assert.equal(source.rights_status, 'candidate');
    assert.equal(source.contact_data_permission, 'not_approved');

    const blockedIngest = await review('POST', '/api/moderation/sports-transfer/sources/' + source.id + '/records', {
      sport: 'football', externalPlayerKey: 'player-1', displayName: 'Test Player',
      availabilityStatus: 'free_agent_reported',
    });
    assert.equal(blockedIngest.status, 403, 'candidate sources cannot ingest player records');

    const approvedSource = await review('PATCH', '/api/moderation/sports-transfer/sources/' + source.id + '/review', {
      decision: 'approved',
      rightsBasis: 'Written source terms permit football player identity and availability discovery.',
      termsReference: 'test-license-' + suffix,
      permittedDataCategories: ['player_identity','sporting_profile','availability_status'],
      permittedPurposes: ['player_discovery','availability_monitoring'],
      note: 'Approved for this test only.',
    });
    assert.equal(approvedSource.status, 200);
    assert.equal((await approvedSource.json()).source.rights_status, 'approved');

    const wrongSport = await review('POST', '/api/moderation/sports-transfer/sources/' + source.id + '/records', {
      sport: 'basketball', externalPlayerKey: 'player-basketball', displayName: 'Basketball Player',
      availabilityStatus: 'trade_available_reported',
    });
    assert.equal(wrongSport.status, 403, 'source sport coverage must be enforced');

    const invalidStatus = await review('POST', '/api/moderation/sports-transfer/sources/' + source.id + '/records', {
      sport: 'football', externalPlayerKey: 'player-invalid', displayName: 'Invalid Player',
      availabilityStatus: 'trade_available_reported',
    });
    assert.equal(invalidStatus.status, 400, 'sport-specific availability vocabulary must be enforced');

    const ingested = await review('POST', '/api/moderation/sports-transfer/sources/' + source.id + '/records', {
      sport: 'football', externalPlayerKey: 'player-' + suffix, displayName: 'Test Free Agent',
      positionOrRole: 'Forward', availabilityStatus: 'free_agent_reported',
      sourceRecordUrl: 'https://league.example/players/test',
      confidenceScore: 0.75,
    });
    assert.equal(ingested.status, 201);
    const record = (await ingested.json()).record;
    assert.equal(record.review_status, 'pending_review');

    const queue = await review('GET', '/api/moderation/sports-transfer/records?status=pending_review', null);
    assert.equal(queue.status, 200);
    assert.ok((await queue.json()).records.some(item => item.id === record.id));

    const approvedRecord = await review('PATCH', '/api/moderation/sports-transfer/records/' + record.id + '/review', {
      decision: 'approved', note: 'Source record checked against permitted sporting-data scope.',
    });
    assert.equal(approvedRecord.status, 200);
    assert.equal((await approvedRecord.json()).record.review_status, 'approved');

    const duplicateReview = await review('PATCH', '/api/moderation/sports-transfer/records/' + record.id + '/review', {
      decision: 'rejected',
    });
    assert.equal(duplicateReview.status, 409, 'review decisions are not repeatable');

    const revoked = await review('PATCH', '/api/moderation/sports-transfer/sources/' + source.id + '/review', {
      decision: 'revoked', note: 'Test revocation.',
    });
    assert.equal(revoked.status, 200);
    const state = await pool.query(
      'SELECT review_status FROM sports_transfer_external_player_records WHERE id=$1',
      [record.id],
    );
    assert.equal(state.rows[0].review_status, 'stale', 'revoking a source removes its records from approved status');

    const audit = await pool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE entity_id = $1 AND event_type LIKE 'sports.discovery.%'",
      [record.id],
    );
    assert.ok(audit.rows[0].count >= 2, 'ingestion and review decisions are audited');

    const publicDiscovery = await fetch(base + '/api/sports-transfer/discovery');
    assert.equal(publicDiscovery.status, 404, 'this phase does not expose a public discovery route');
    console.log('Sports Transfer discovery ingestion and moderation API tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Sports Transfer discovery API test failed:', error);
  process.exitCode = 1;
});
