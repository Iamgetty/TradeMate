const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Sports Transfer private API integration tests.');

  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 3,
  });
  let app;

  try {
    const suffix = randomUUID();
    const actors = {};
    for (const role of ['player', 'recipient', 'outsider']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Sports API test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'sports-api-' + role + '-' + suffix;
      await rawPool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [userId, tokenHash(token)],
      );
      actors[role] = { userId, token };
    }

    const sportingOrg = await rawPool.query(
      "INSERT INTO sports_organizations (entity_type, legal_name, display_name, country_code, created_by_user_id) VALUES ('club', $1, $2, 'NG', $3) RETURNING id",
      ['Sports API Club ' + suffix, 'Sports API Club', actors.player.userId],
    );
    const sportingOrgId = sportingOrg.rows[0].id;

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const baseUrl = 'http://127.0.0.1:' + address.port;

    const call = (actor, method, path, body) => fetch(baseUrl + path, {
      method,
      headers: {
        ...(actor ? { cookie: 'trademate_session=' + encodeURIComponent(actors[actor].token) } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const unauthenticated = await call(null, 'GET', '/api/sports-transfer/profiles/mine');
    assert.equal(unauthenticated.status, 401, 'private player profiles must require an authenticated session');

    const created = await call('player', 'POST', '/api/sports-transfer/profiles', {
      sport: 'football',
      displayName: 'Test football player',
      biography: 'A private integration-test profile.',
      primaryPosition: 'Midfielder',
      countryCode: 'NG',
    });
    assert.equal(created.status, 201, 'player must be able to create a football profile');
    const football = (await created.json()).profile;
    assert.equal(football.visibility, 'private', 'new profiles must remain private');
    assert.equal(football.verification_status, 'unverified', 'profile creation must not imply verification');

    const duplicate = await call('player', 'POST', '/api/sports-transfer/profiles', {
      sport: 'football',
      displayName: 'Duplicate football profile',
    });
    assert.equal(duplicate.status, 409, 'a user must not create a second profile for the same sport');

    const basketballResponse = await call('player', 'POST', '/api/sports-transfer/profiles', {
      sport: 'basketball',
      displayName: 'Test basketball player',
    });
    assert.equal(basketballResponse.status, 201, 'a user may maintain a separate basketball profile');
    const basketball = (await basketballResponse.json()).profile;

    const mine = await call('player', 'GET', '/api/sports-transfer/profiles/mine');
    assert.equal(mine.status, 200);
    assert.equal((await mine.json()).profiles.length, 2, 'the owner must see only their own launch-sport profiles');

    const update = await call('player', 'PATCH', '/api/sports-transfer/profiles/' + football.id, {
      biography: 'Updated private biography.',
      countryCode: null,
    });
    assert.equal(update.status, 200, 'profile owner must be able to update their own profile');
    const updatedProfile = (await update.json()).profile;
    assert.equal(updatedProfile.biography, 'Updated private biography.');
    assert.equal(updatedProfile.country_code, null, 'the owner must be able to clear an optional country code');
    assert.equal(updatedProfile.visibility, 'private', 'profile editing must not silently publish a profile');

    const outsiderUpdate = await call('outsider', 'PATCH', '/api/sports-transfer/profiles/' + football.id, {
      displayName: 'Unauthorized edit',
    });
    assert.equal(outsiderUpdate.status, 404, 'another account must not edit a private player profile');

    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const consentBody = {
      targetUserId: actors.recipient.userId,
      purpose: 'negotiation',
      scope: { territoryCodes: ['NG'], note: 'Test-only negotiation consent.' },
      expiresAt: expiry,
    };
    const granted = await call('player', 'POST', '/api/sports-transfer/profiles/' + football.id + '/consents', consentBody);
    assert.equal(granted.status, 201, 'the player must be able to grant time-limited recipient-specific consent');
    const consent = (await granted.json()).consent;
    assert.equal(consent.status, 'granted');
    assert.equal(consent.granted_to_user_id, actors.recipient.userId);

    const bothTargets = await call('player', 'POST', '/api/sports-transfer/profiles/' + football.id + '/consents', {
      ...consentBody,
      targetOrganizationId: sportingOrgId,
    });
    assert.equal(bothTargets.status, 400, 'consent must not accept two recipients');

    const noTarget = await call('player', 'POST', '/api/sports-transfer/profiles/' + football.id + '/consents', {
      purpose: 'direct_contact',
      expiresAt: expiry,
    });
    assert.equal(noTarget.status, 400, 'consent must identify exactly one recipient');

    const excessiveExpiry = await call('player', 'POST', '/api/sports-transfer/profiles/' + football.id + '/consents', {
      ...consentBody,
      expiresAt: new Date(Date.now() + 400 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(excessiveExpiry.status, 400, 'consent lifetime must be capped at 12 months');

    const orgConsent = await call('player', 'POST', '/api/sports-transfer/profiles/' + basketball.id + '/consents', {
      targetOrganizationId: sportingOrgId,
      purpose: 'direct_contact',
      expiresAt: expiry,
    });
    assert.equal(orgConsent.status, 201, 'consent may be scoped to one sporting organization');

    const list = await call('player', 'GET', '/api/sports-transfer/profiles/' + football.id + '/consents');
    assert.equal(list.status, 200);
    assert.equal((await list.json()).consents.length, 1);

    const outsiderList = await call('outsider', 'GET', '/api/sports-transfer/profiles/' + football.id + '/consents');
    assert.equal(outsiderList.status, 404, 'another account must not inspect a player consent ledger');

    const outsiderRevoke = await call('outsider', 'POST', '/api/sports-transfer/consents/' + consent.id + '/revoke');
    assert.equal(outsiderRevoke.status, 404, 'another account must not revoke a player consent');

    const revoked = await call('player', 'POST', '/api/sports-transfer/consents/' + consent.id + '/revoke');
    assert.equal(revoked.status, 201, 'the player must be able to revoke their own consent');
    assert.equal((await revoked.json()).consent.status, 'revoked');

    const duplicateRevoke = await call('player', 'POST', '/api/sports-transfer/consents/' + consent.id + '/revoke');
    assert.equal(duplicateRevoke.status, 404, 'a revoked consent must not be revoked a second time');

    const publicRead = await call(null, 'GET', '/api/sports-transfer/profiles/' + football.id);
    assert.equal(publicRead.status, 404, 'this API slice must not expose a public profile read route');

    const stored = await rawPool.query(
      "SELECT status, granted_by_user_id FROM sports_player_consents WHERE id = $1",
      [consent.id],
    );
    assert.equal(stored.rows[0].status, 'revoked');
    assert.equal(stored.rows[0].granted_by_user_id, actors.player.userId,
      'the player must be recorded as the consent grantor');

    const audit = await rawPool.query(
      "SELECT event_type FROM audit_events WHERE entity_type = 'sports_player_consent' AND entity_id = $1 ORDER BY created_at",
      [consent.id],
    );
    assert.deepEqual(audit.rows.map((row) => row.event_type), ['sports.consent.granted', 'sports.consent.revoked'],
      'consent grant and revocation must both be audited');

    console.log('Sports Transfer private profile and consent HTTP integration tests passed.');
  } finally {
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Sports Transfer private API integration test failed:', error);
  process.exitCode = 1;
});
