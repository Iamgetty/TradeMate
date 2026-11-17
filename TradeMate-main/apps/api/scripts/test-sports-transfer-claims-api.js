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
  process.env.TRADEMATE_REVIEW_API_KEY = 'sports-claims-test-review-key';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  let app;
  try {
    const suffix = randomUUID();
    const makeUser = async label => {
      const result = await pool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1,$2,'active') RETURNING id",
        [`sports-claim-${label}-${suffix}@example.invalid`, label],
      );
      const token = `sports-claim-${label}-${suffix}`;
      await pool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '10 minutes')",
        [result.rows[0].id, tokenHash(token)],
      );
      return { id: result.rows[0].id, token };
    };
    const claimant = await makeUser('Verified Claimant');
    const unverified = await makeUser('Unverified Claimant');

    const profile = async (user, status, sport = 'football') => {
      const result = await pool.query(
        "INSERT INTO sports_profiles (user_id,sport,display_name,verification_status) VALUES ($1,$2,$3,$4) RETURNING id",
        [user.id, sport, 'Claim Profile ' + status + ' ' + suffix.slice(0, 8), status],
      );
      return result.rows[0].id;
    };
    const verifiedProfile = await profile(claimant, 'verified');
    const unverifiedProfile = await profile(unverified, 'unverified');
    const otherSportProfile = await profile(claimant, 'verified', 'basketball');

    const sourceResult = await pool.query(
      `INSERT INTO sports_transfer_data_sources
       (source_key,display_name,source_type,rights_status,rights_basis,terms_reference,
        permitted_data_categories,permitted_purposes,coverage_sports,reviewed_at,reviewer_key_id)
       VALUES ($1,'Claims Test League','official_league','approved',
        'Written league terms permit identity and availability discovery.',
        'claims-test-terms',
        ARRAY['player_identity','sporting_profile','availability_status']::text[],
        ARRAY['player_discovery']::text[],ARRAY['football']::text[],now(),'claims-test-key')
       RETURNING id`,
      ['claims-test-' + suffix],
    );
    const sourceId = sourceResult.rows[0].id;
    const makeRecord = async key => {
      const result = await pool.query(
        `INSERT INTO sports_transfer_external_player_records
         (data_source_id,sport,external_player_key,display_name,availability_status,
          review_status,reviewed_at,reviewer_key_id,last_verified_at,expires_at)
         VALUES ($1,'football',$2,$3,'free_agent_reported','approved',now(),
                 'claims-test-key',now(),now() + interval '3 days')
         RETURNING id`,
        [sourceId, key, 'External Player ' + key.slice(0, 8)],
      );
      return result.rows[0].id;
    };
    const recordId = await makeRecord('approved-' + suffix);
    const rejectRecordId = await makeRecord('reject-' + suffix);

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
    const userRequest = (token, method, path, body) => fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { cookie: 'trademate_session=' + encodeURIComponent(token) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const reviewRequest = (method, path, body, key = true) => fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(key ? { 'x-review-key': process.env.TRADEMATE_REVIEW_API_KEY } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const claimBody = profileId => ({
      profileId,
      claimStatement: 'I am the player represented by this sporting record and can substantiate the match through the club and competition history.',
      evidenceUrl: 'https://league.example/players/identity-evidence',
    });

    const noSession = await userRequest('', 'POST', '/api/sports-transfer/external-records/' + recordId + '/claims', claimBody(verifiedProfile));
    assert.equal(noSession.status, 401, 'claim creation requires an authenticated account');

    const unverifiedClaim = await userRequest(unverified.token, 'POST', '/api/sports-transfer/external-records/' + recordId + '/claims', claimBody(unverifiedProfile));
    assert.equal(unverifiedClaim.status, 403, 'unverified sporting profiles cannot claim external records');

    const wrongSport = await userRequest(claimant.token, 'POST', '/api/sports-transfer/external-records/' + recordId + '/claims', claimBody(otherSportProfile));
    assert.equal(wrongSport.status, 400, 'profile sport must match the external record sport');

    const created = await userRequest(claimant.token, 'POST', '/api/sports-transfer/external-records/' + recordId + '/claims', claimBody(verifiedProfile));
    assert.equal(created.status, 201);
    const claim = (await created.json()).claim;
    assert.equal(claim.status, 'pending_review');

    const duplicate = await userRequest(claimant.token, 'POST', '/api/sports-transfer/external-records/' + recordId + '/claims', claimBody(verifiedProfile));
    assert.equal(duplicate.status, 409, 'duplicate pending claims are blocked');

    const mine = await userRequest(claimant.token, 'GET', '/api/sports-transfer/claims/mine');
    assert.equal(mine.status, 200);
    const mineClaims = (await mine.json()).claims;
    assert.ok(mineClaims.some(item => item.id === claim.id));

    const otherMine = await userRequest(unverified.token, 'GET', '/api/sports-transfer/claims/mine');
    assert.equal(otherMine.status, 200);
    assert.equal((await otherMine.json()).claims.some(item => item.id === claim.id), false, 'claimants cannot see another account claims');

    const noReviewKey = await reviewRequest('GET', '/api/moderation/sports-transfer/claims', null, false);
    assert.equal(noReviewKey.status, 401, 'moderation queue requires the review key');

    const queue = await reviewRequest('GET', '/api/moderation/sports-transfer/claims?status=pending_review');
    assert.equal(queue.status, 200);
    assert.ok((await queue.json()).claims.some(item => item.id === claim.id));

    const approved = await reviewRequest('PATCH', '/api/moderation/sports-transfer/claims/' + claim.id + '/review', {
      decision: 'approved',
      note: 'Verified identity and sporting history against independent source evidence.',
    });
    assert.equal(approved.status, 200);
    assert.equal((await approved.json()).claim.status, 'approved');

    const linked = await pool.query(
      'SELECT claimed_profile_id, claim_status FROM sports_transfer_external_player_records WHERE id=$1',
      [recordId],
    );
    assert.equal(linked.rows[0].claimed_profile_id, verifiedProfile, 'profile link is created only after human approval');
    assert.equal(linked.rows[0].claim_status, 'verified');

    const duplicateReview = await reviewRequest('PATCH', '/api/moderation/sports-transfer/claims/' + claim.id + '/review', {
      decision: 'rejected',
    });
    assert.equal(duplicateReview.status, 409, 'claim decisions cannot be repeated');

    const secondClaimResponse = await userRequest(claimant.token, 'POST', '/api/sports-transfer/external-records/' + rejectRecordId + '/claims', claimBody(verifiedProfile));
    assert.equal(secondClaimResponse.status, 201);
    const secondClaim = (await secondClaimResponse.json()).claim;
    const rejected = await reviewRequest('PATCH', '/api/moderation/sports-transfer/claims/' + secondClaim.id + '/review', {
      decision: 'rejected', note: 'Identity match could not be established.',
    });
    assert.equal(rejected.status, 200);
    const rejectedLink = await pool.query(
      'SELECT claimed_profile_id, claim_status FROM sports_transfer_external_player_records WHERE id=$1',
      [rejectRecordId],
    );
    assert.equal(rejectedLink.rows[0].claimed_profile_id, null, 'rejected claims never link a player profile');
    assert.equal(rejectedLink.rows[0].claim_status, 'rejected');

    const notification = await pool.query(
      "SELECT count(*)::int AS count FROM user_notifications WHERE user_id=$1 AND title LIKE 'Sports Transfer identity claim %'",
      [claimant.id],
    );
    assert.ok(notification.rows[0].count >= 2, 'claim decisions notify the claimant account');

    const audit = await pool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE entity_type='sports_transfer_external_player_claim' AND entity_id = ANY($1::uuid[])",
      [[claim.id, secondClaim.id]],
    );
    assert.ok(audit.rows[0].count >= 4, 'claim submissions and review decisions are audited');

    console.log('Sports Transfer external player identity claim API tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error('Sports Transfer external player identity claim tests failed:', error);
  process.exitCode = 1;
});
