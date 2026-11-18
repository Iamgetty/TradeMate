const assert = require('node:assert/strict');
const { randomUUID, createHash, createHmac } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = token => createHash('sha256').update(token).digest('hex');
const sandboxSignature = (rawBody, timestamp = Math.floor(Date.now() / 1000)) => ({
  timestamp: String(timestamp),
  signature: 'sha256=' + createHmac('sha256', process.env.SPORTS_TRANSFER_SANDBOX_WEBHOOK_SECRET)
    .update(Buffer.concat([Buffer.from(String(timestamp) + '.'), Buffer.from(rawBody)]))
    .digest('hex'),
});

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
    const unauthenticatedSessionStatus = await userRequest('GET', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session', undefined, false);
    assert.equal(unauthenticatedSessionStatus.status, 401, 'session status is private and requires authentication');
    const sessionStatus = await userRequest('GET', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(sessionStatus.status, 200);
    const sessionStatusResult = await sessionStatus.json();
    assert.equal(sessionStatusResult.session.status, 'created');
    assert.equal(sessionStatusResult.session.provider_key, 'sandbox');
    assert.equal(sessionStatusResult.providerPollingAvailable, false,
      'the endpoint must not imply that a live provider status was polled');
    assert.equal(Object.hasOwn(sessionStatusResult.session, 'provider_session_reference'), false,
      'opaque provider references must not be exposed in the owner status response');
    const reusedSession = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(reusedSession.status, 201);
    assert.equal((await reusedSession.json()).reused, true, 'active provider sessions are reused rather than duplicated');

    await pool.query(
      "UPDATE sports_transfer_verification_sessions SET expires_at = now() - interval '1 minute' WHERE verification_case_id = $1 AND status = 'created'",
      [legalCase.id],
    );
    const expiredSessionStatus = await userRequest('GET', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(expiredSessionStatus.status, 200);
    assert.equal((await expiredSessionStatus.json()).session.status, 'expired',
      'locally expired sessions must be reflected in the owner status endpoint');
    const replacementSession = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(replacementSession.status, 201);
    const replacementSessionResult = await replacementSession.json();
    assert.equal(replacementSessionResult.reused, false,
      'an expired session must not be reused');
    assert.notEqual(replacementSessionResult.session.id, sessionResult.session.id,
      'an expired session is replaced with a new opaque session reference');
    const sessionPrivacy = await userRequest('POST', '/api/sports-transfer/verification-cases/' + caseRecord.id + '/session');
    assert.equal(sessionPrivacy.status, 400, 'sporting identity evidence cannot be sent through the legal KYC session');

    // Exercise the real Sumsub API adapter without external network access.
    const nativeFetch = global.fetch;
    process.env.SPORTS_TRANSFER_IDENTITY_PROVIDER = 'sumsub';
    process.env.SUMSUB_APP_TOKEN = 'sumsub-test-app-token';
    process.env.SUMSUB_SECRET_KEY = 'sumsub-test-secret-key';
    process.env.SUMSUB_KYC_LEVEL_NAME = 'trademate-sandbox-kyc';
    process.env.SUMSUB_WEBHOOK_SECRET = 'sumsub-test-webhook-secret';
    let sumsubAccessTokenCalls = 0;
    global.fetch = async (url, options) => {
      if (String(url).startsWith(base)) return nativeFetch(url, options);
      const bodyText = options?.body || '';
      const timestamp = options?.headers?.['X-App-Access-Ts'];
      const expectedSignature = createHmac('sha256', process.env.SUMSUB_SECRET_KEY)
        .update(String(timestamp) + String(options.method).toUpperCase() + new URL(url).pathname + bodyText)
        .digest('hex');
      assert.equal(options.headers['X-App-Token'], process.env.SUMSUB_APP_TOKEN);
      assert.equal(options.headers['X-App-Access-Sig'], expectedSignature,
        'Sumsub API requests must use the documented HMAC request signature');
      if (String(url).includes('/resources/accessTokens/sdk')) {
        sumsubAccessTokenCalls += 1;
        const sent = JSON.parse(bodyText);
        assert.equal(sent.userId, legalCase.id);
        assert.equal(sent.levelName, process.env.SUMSUB_KYC_LEVEL_NAME);
        return new Response(JSON.stringify({ token: 'short-lived-sumsub-sdk-token', userId: sent.userId }), {
          status: 200, headers: { 'content-type': 'application/json' },
        });
      }
      if (String(url).includes('/resources/applicants/-;externalUserId=')) {
        return new Response(JSON.stringify({
          review: { reviewStatus: 'completed', reviewResult: { reviewAnswer: 'GREEN' } },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      throw new Error('Unexpected Sumsub test URL.');
    };
    const sumsubSessionResponse = await userRequest('POST', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(sumsubSessionResponse.status, 201);
    const sumsubSession = await sumsubSessionResponse.json();
    assert.equal(sumsubSession.session.provider_key, 'sumsub');
    assert.equal(sumsubSession.sdkAccessToken, 'short-lived-sumsub-sdk-token');
    assert.ok(sumsubSession.sdkTokenExpiresAt);
    assert.equal(sumsubAccessTokenCalls, 1);
    const sumsubStatusResponse = await userRequest('GET', '/api/sports-transfer/verification-cases/' + legalCase.id + '/session');
    assert.equal(sumsubStatusResponse.status, 200);
    const sumsubStatus = await sumsubStatusResponse.json();
    assert.equal(sumsubStatus.providerPollingAvailable, true);
    assert.equal(sumsubStatus.providerOutcome, 'succeeded');
    const sumsubCaseStatus = await pool.query('SELECT status FROM sports_transfer_verification_cases WHERE id = $1', [legalCase.id]);
    assert.equal(sumsubCaseStatus.rows[0].status, 'needs_review',
      'a Sumsub GREEN result must still require independent TradeMate human review');
    global.fetch = nativeFetch;
    process.env.SPORTS_TRANSFER_IDENTITY_PROVIDER = 'sandbox';

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
    const unmatchedAuth = sandboxSignature(unmatchedEvent);
    const unmatchedWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': unmatchedAuth.timestamp, 'x-trademate-signature': unmatchedAuth.signature },
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
    const providerAuth = sandboxSignature(providerEvent);
    const webhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': providerAuth.timestamp, 'x-trademate-signature': providerAuth.signature },
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
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': providerAuth.timestamp, 'x-trademate-signature': providerAuth.signature },
      body: providerEvent,
    });
    assert.equal(duplicateWebhook.status, 200);
    assert.equal((await duplicateWebhook.json()).duplicate, true, 'provider event replay is idempotent');

    const conflictingReplayBody = JSON.stringify({
      eventId: 'event-' + suffix,
      caseReference: providerCase,
      outcome: 'failed',
    });
    const conflictingReplayAuth = sandboxSignature(conflictingReplayBody);
    const conflictingReplay = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': conflictingReplayAuth.timestamp, 'x-trademate-signature': conflictingReplayAuth.signature },
      body: conflictingReplayBody,
    });
    assert.equal(conflictingReplay.status, 409,
      'a provider event ID reused with different signed content must be rejected');

    const invalidWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': providerAuth.timestamp, 'x-trademate-signature': 'sha256=' + '0'.repeat(64) },
      body: providerEvent,
    });
    assert.equal(invalidWebhook.status, 401, 'invalid provider webhook signature is rejected');
    const staleAuth = sandboxSignature(providerEvent, Math.floor(Date.now() / 1000) - 301);
    const staleWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-timestamp': staleAuth.timestamp, 'x-trademate-signature': staleAuth.signature },
      body: providerEvent,
    });
    assert.equal(staleWebhook.status, 401, 'correctly signed stale webhook timestamps are rejected');
    const missingTimestampWebhook = await fetch(base + '/api/webhooks/sports-transfer/identity/sandbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trademate-signature': providerAuth.signature },
      body: providerEvent,
    });
    assert.equal(missingTimestampWebhook.status, 401, 'sandbox webhook timestamp is mandatory');
    // Bind the case to Sumsub while exercising its signed webhook adapter.
    await pool.query(
      "UPDATE sports_transfer_verification_cases SET provider_key = 'sumsub', provider_subject_reference = $1 WHERE id = $2",
      [legalCase.id, legalCase.id],
    );
    // Sumsub webhooks use their documented raw-body HMAC digest headers.
    const sumsubWebhookBody = JSON.stringify({
      applicantId: 'sumsub-applicant-test',
      externalUserId: legalCase.id,
      correlationId: 'sumsub-correlation-' + suffix,
      type: 'applicantReviewed',
      reviewStatus: 'completed',
      reviewResult: { reviewAnswer: 'GREEN' },
      createdAtMs: '2026-11-17 12:30:00.000',
    });
    const sumsubDigest = createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET)
      .update(Buffer.from(sumsubWebhookBody)).digest('hex');
    const sumsubWebhookHeaders = {
      'content-type': 'application/json',
      'x-payload-digest-alg': 'HMAC_SHA256_HEX',
      'x-payload-digest': sumsubDigest,
    };
    const sumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST', headers: sumsubWebhookHeaders, body: sumsubWebhookBody,
    });
    assert.equal(sumsubWebhook.status, 200);
    assert.equal((await sumsubWebhook.json()).humanReviewRequired, true);
    const duplicateSumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST', headers: sumsubWebhookHeaders, body: sumsubWebhookBody,
    });
    assert.equal(duplicateSumsubWebhook.status, 200);
    assert.equal((await duplicateSumsubWebhook.json()).duplicate, true,
      'Sumsub webhook retries must be idempotent');
    const invalidSumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST',
      headers: { ...sumsubWebhookHeaders, 'x-payload-digest': '0'.repeat(64) },
      body: sumsubWebhookBody,
    });
    assert.equal(invalidSumsubWebhook.status, 401,
      'invalid Sumsub webhook digest must be rejected');
    const unsupportedSumsubBody = JSON.stringify({
      applicantId: 'sumsub-applicant-test',
      externalUserId: legalCase.id,
      correlationId: 'sumsub-unrelated-' + suffix,
      type: 'applicantCreated',
      reviewStatus: 'completed',
      reviewResult: { reviewAnswer: 'GREEN' },
      createdAtMs: '2026-11-17 12:30:00.000',
    });
    const unsupportedSumsubDigest = createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET)
      .update(Buffer.from(unsupportedSumsubBody)).digest('hex');
    const unsupportedSumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST',
      headers: { ...sumsubWebhookHeaders, 'x-payload-digest': unsupportedSumsubDigest },
      body: unsupportedSumsubBody,
    });
    assert.equal(unsupportedSumsubWebhook.status, 401,
      'signed Sumsub events other than applicantReviewed must not enter identity review');
    const manualTestSumsubBody = JSON.stringify({
      applicantId: 'sumsub-dashboard-test',
      externalUserId: legalCase.id,
      correlationId: 'sumsub-manual-test-' + suffix,
      type: 'applicantReviewed',
      testMode: true,
      reviewStatus: 'completed',
      reviewResult: { reviewAnswer: 'GREEN' },
      createdAtMs: '2026-11-17 12:30:00.000',
    });
    const manualTestSumsubDigest = createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET)
      .update(Buffer.from(manualTestSumsubBody)).digest('hex');
    const manualTestSumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST',
      headers: { ...sumsubWebhookHeaders, 'x-payload-digest': manualTestSumsubDigest },
      body: manualTestSumsubBody,
    });
    assert.equal(manualTestSumsubWebhook.status, 401,
      'Sumsub Dashboard test webhooks must not be treated as applicant verification results');
    const conflictingSumsubBody = JSON.stringify({
      applicantId: 'sumsub-applicant-test',
      externalUserId: legalCase.id,
      correlationId: 'sumsub-correlation-' + suffix,
      type: 'applicantReviewed',
      reviewStatus: 'completed',
      reviewResult: { reviewAnswer: 'RED' },
      createdAtMs: '2026-11-17 12:30:00.000',
    });
    const conflictingSumsubDigest = createHmac('sha256', process.env.SUMSUB_WEBHOOK_SECRET)
      .update(Buffer.from(conflictingSumsubBody)).digest('hex');
    const conflictingSumsubWebhook = await nativeFetch(base + '/api/webhooks/sports-transfer/identity/sumsub', {
      method: 'POST',
      headers: { ...sumsubWebhookHeaders, 'x-payload-digest': conflictingSumsubDigest },
      body: conflictingSumsubBody,
    });
    assert.equal(conflictingSumsubWebhook.status, 409,
      'Sumsub event identity reused with different signed content must be rejected');
    await pool.query(
      "UPDATE sports_transfer_verification_cases SET provider_key = 'sandbox', provider_subject_reference = $1 WHERE id = $2",
      [providerCase, legalCase.id],
    );

    const duplicate = await userRequest('POST', '/api/sports-transfer/verification-cases', body);
    assert.equal(duplicate.status, 409, 'duplicate open sporting identity cases are blocked');

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
