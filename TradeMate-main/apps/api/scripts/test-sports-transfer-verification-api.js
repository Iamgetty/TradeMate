const assert = require('node:assert/strict');
const { randomUUID, createHash, createHmac } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = token => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  process.env.TRADEMATE_REVIEW_API_KEY = 'sports-verification-test-review-key';
  process.env.SPORTS_TRANSFER_SANDBOX_WEBHOOK_SECRET = 'sports-verification-webhook-test-secret';
  process.env.SPORTS_TRANSFER_IDENTITY_PROVIDER = 'sandbox';
  process.env.SPORTS_TRANSFER_SANDBOX_ENABLED = 'true';
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  let app;
  try {
    const suffix = randomUUID();
    const userResult = await pool.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1,$2,'active') RETURNING id",
      [`sports-verification-${suffix}@example.invalid`, 'Verification Test User'],
    );
    const userId = userResult.rows[0].id;
    const token = 'sports-verification-' + suffix;
    await pool.query(
      "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '10 minutes')",
      [userId, tokenHash(token)],
    );
    const profileResult = await pool.query(
      "INSERT INTO sports_profiles (user_id,sport,display_name) VALUES ($1,'football',$2) RETURNING id",
      [userId, 'Verification Test Profile ' + suffix.slice(0, 8)],
    );
    const profileId = profileResult.rows[0].id;

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb', verify: (request, _response, buffer) => { request.rawBody = Buffer.from(buffer); } }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
    const userRequest = (method, path, body, authenticated = true) => fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(authenticated ? { cookie: 'trademate_session=' + encodeURIComponent(token) } : {}),
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
    const body = {
      caseType: 'sporting_identity',
      profileId,
      countryCode: 'NG',
      claimStatement: 'I am the player represented by this football profile and request independent verification using the official club and competition evidence referenced here.',
      evidenceUrl: 'https://club.example/players/evidence',
    };
    const noAuth = await userRequest('POST', '/api/sports-transfer/verification-cases', body, false);
    assert.equal(noAuth.status, 401, 'verification case creation requires authentication');
    const created = await userRequest('POST', '/api/sports-transfer/verification-cases', body);
    assert.equal(created.status, 201);
    const caseRecord = (await created.json()).verificationCase;
    assert.equal(caseRecord.case_type, 'sporting_identity');
    assert.equal(caseRecord.status, 'submitted');

    const legalBody = {
      caseType: 'legal_identity',
      countryCode: 'NG',
      claimStatement: 'I request legal identity assurance for my TradeMate account. Identity documents will be handled only by an approved verification workflow.',
    };
    const legalCreated = await userRequest('POST', '/api/sports-transfer/verification-cases', legalBody);
    assert.equal(legalCreated.status, 201);
    const legalCase = (await legalCreated.json()).verificationCase;

    await pool.query(
      "UPDATE sports_transfer_verification_cases SET provider_key = 'sandbox', provider_subject_reference = '' WHERE id = $1",
      [legalCase.id],
    );
    const providerCase = 'future-provider-case-' + legalCase.id;
    const unmatchedEvent = JSON.stringify({
      eventId: 'unmatched-event-' + suffix,
      caseReference: providerCase,
      outcome: 'succeeded',
    });
    const unmatchedSignature = 'sha256=' + createHmac('sha256', process.env.SPORTS_TRANSFER_SANDBOX_WEBHOOK_SECRET).update(Buffer.from(unmatchedEvent)).digest('hex');
    const unmatchedWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-signature': unmatchedSignature },
      body: unmatchedEvent,
    });
    assert.equal(unmatchedWebhook.status, 200);
    assert.equal((await unmatchedWebhook.json()).matched, false);
    const pendingReconcile = await reviewRequest('POST', '/api/moderation/sports-transfer/verification-cases/provider-events/sandbox/unmatched-event-' + suffix + '/reconcile');
    assert.equal(pendingReconcile.status, 200);
    assert.equal((await pendingReconcile.json()).matched, false);
    await pool.query(
      'UPDATE sports_transfer_verification_cases SET provider_subject_reference = $1 WHERE id = $2',
      [providerCase, legalCase.id],
    );
    const reconciledEvent = await reviewRequest('POST', '/api/moderation/sports-transfer/verification-cases/provider-events/sandbox/unmatched-event-' + suffix + '/reconcile');
    assert.equal(reconciledEvent.status, 200);
    assert.equal((await reconciledEvent.json()).reconciled, true,
      'late case mapping reconciles the retained unmatched provider event');
    const providerEvent = JSON.stringify({
      eventId: 'event-' + suffix,
      caseReference: providerCase,
      outcome: 'succeeded',
    });
    process.env.SPORTS_TRANSFER_SUMSUB_WEBHOOK_SECRET = 'placeholder-not-a-real-adapter-secret';
    const unimplementedVendorWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: providerEvent,
    });
    assert.equal(unimplementedVendorWebhook.status, 503,
      'vendor webhooks must fail closed until provider-specific adapters exist');
    const providerSignature = 'sha256=' + createHmac('sha256', process.env.SPORTS_TRANSFER_SANDBOX_WEBHOOK_SECRET).update(Buffer.from(providerEvent)).digest('hex');
    const webhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-signature': providerSignature },
      body: providerEvent,
    });
    assert.equal(webhook.status, 200, 'valid signed provider webhook is accepted');
    const webhookResult = await webhook.json();
    assert.equal(webhookResult.humanReviewRequired, true);
    const webhookCase = await pool.query('SELECT status FROM sports_transfer_verification_cases WHERE id = $1', [legalCase.id]);
    assert.equal(webhookCase.rows[0].status, 'needs_review',
      'provider success must never directly approve an identity');

    const duplicateWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-signature': providerSignature },
      body: providerEvent,
    });
    assert.equal(duplicateWebhook.status, 200);
    assert.equal((await duplicateWebhook.json()).duplicate, true, 'provider event replay is idempotent');

    const invalidWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-signature': 'sha256=' + '0'.repeat(64) },
      body: providerEvent,
    });
    assert.equal(invalidWebhook.status, 401, 'invalid provider webhook signature is rejected');
    const duplicate = await userRequest('POST', '/api/sports-transfer/verification-cases', body);
    assert.equal(duplicate.status, 409, 'duplicate open sporting identity cases are blocked');

    process.env.SPORTS_TRANSFER_SANDBOX_ENABLED = 'false';
    const disabledSession = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(disabledSession.status, 503, 'provider sessions stay disabled unless sandbox mode is explicitly enabled');
    process.env.SPORTS_TRANSFER_SANDBOX_ENABLED = 'true';
    const sessionResponse = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(sessionResponse.status, 201);
    const sessionResult = await sessionResponse.json();
    assert.equal(sessionResult.session.provider_key, 'sandbox');
    assert.equal(sessionResult.session.status, 'created');
    assert.equal(sessionResult.hostedUrl, null, 'sandbox must not pretend to provide a hosted identity flow');
    assert.equal(sessionResult.reused, false);
    const reusedSession = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(reusedSession.status, 201);
    assert.equal((await reusedSession.json()).reused, true, 'active provider sessions are reused rather than duplicated');
    const sessionPrivacy = await userRequest('POST', '/api/sports-transfer/verification-cases/' + caseRecord.id + '/session');
    assert.equal(sessionPrivacy.status, 400, 'sporting identity evidence cannot be sent through the legal KYC session');
    const noKey = await reviewRequest('PATCH', '/api/moderation/sports-transfer/verification-cases/' + caseRecord.id + '/review', {
      decision: 'verified', reasonCode: 'official_roster_match',
    }, false);
    assert.equal(noKey.status, 401, 'review requires moderation credentials');

    const queue = await reviewRequest('GET', '/api/moderation/sports-transfer/verification-cases');
    assert.equal(queue.status, 200);
    assert.ok((await queue.json()).verificationCases.some(item => item.id === caseRecord.id));

    const legalReview = await reviewRequest('PATCH', '/api/moderation/sports-transfer/verification-cases/' + legalCase.id + '/review', {
      decision: 'verified', reasonCode: 'manual_identity_review_passed',
    });
    assert.equal(legalReview.status, 200);
    const unchangedProfile = await pool.query('SELECT verification_status FROM sports_profiles WHERE id = $1', [profileId]);
    assert.equal(unchangedProfile.rows[0].verification_status, 'unverified',
      'legal identity approval must not verify sporting identity');

    const sportingReview = await reviewRequest('PATCH', '/api/moderation/sports-transfer/verification-cases/' + caseRecord.id + '/review', {
      decision: 'verified', reasonCode: 'official_roster_match',
      note: 'Independent official club evidence reviewed.',
    });
    assert.equal(sportingReview.status, 200);
    const verifiedProfile = await pool.query('SELECT verification_status FROM sports_profiles WHERE id = $1', [profileId]);
    assert.equal(verifiedProfile.rows[0].verification_status, 'verified',
      'sporting identity changes only after moderator approval');
    const repeat = await reviewRequest('PATCH', '/api/moderation/sports-transfer/verification-cases/' + caseRecord.id + '/review', {
      decision: 'rejected', reasonCode: 'duplicate_decision',
    });
    assert.equal(repeat.status, 409, 'final verification decisions are immutable');

    const mine = await userRequest('GET', '/api/sports-transfer/verification-cases/mine');
    assert.equal(mine.status, 200);
    const mineCases = (await mine.json()).verificationCases;
    assert.ok(mineCases.some(item => item.id === caseRecord.id));
    assert.ok(mineCases.some(item => item.id === legalCase.id));

    const noProfileForLegal = await userRequest('POST', '/api/sports-transfer/verification-cases', {
      ...legalBody, profileId,
    });
    assert.equal(noProfileForLegal.status, 400, 'legal and sporting identity cases remain separate');

    console.log('Sports Transfer identity verification case API tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
