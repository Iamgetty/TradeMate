const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Sports Transfer mandate API tests.');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 4,
  });
  let app;
  try {
    const suffix = randomUUID();
    const actors = {};
    for (const role of ['player', 'representative', 'representative2', 'representative3', 'organizationOwner', 'organizationAdmin', 'organizationMember', 'expiredAdmin', 'futureAdmin', 'outsider']) {
      const user = await pool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Mandate test ' + role],
      );
      const token = 'sports-mandate-' + role + '-' + suffix;
      await pool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [user.rows[0].id, tokenHash(token)],
      );
      actors[role] = { userId: user.rows[0].id, token };
    }

    const org = await pool.query(
      "INSERT INTO sports_organizations (entity_type, legal_name, display_name, country_code, created_by_user_id) VALUES ('agency', $1, $2, 'NG', $3) RETURNING id",
      ['Mandate Test Agency ' + suffix, 'Mandate Test Agency', actors.organizationOwner.userId],
    );
    const organizationId = org.rows[0].id;
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1, $2, 'owner', 'workspace', 'active', $2, now())",
      [organizationId, actors.organizationOwner.userId],
    );
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1, $2, 'admin', 'workspace', 'active', $3, now())",
      [organizationId, actors.organizationAdmin.userId, actors.organizationOwner.userId],
    );
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1, $2, 'member', 'workspace', 'active', $3, now())",
      [organizationId, actors.organizationMember.userId, actors.organizationOwner.userId],
    );
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at, expires_at) VALUES ($1, $2, 'admin', 'workspace', 'active', $3, now() - interval '2 days', now() - interval '1 day')",
      [organizationId, actors.expiredAdmin.userId, actors.organizationOwner.userId],
    );
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1, $2, 'admin', 'workspace', 'active', $3, now() + interval '1 day')",
      [organizationId, actors.futureAdmin.userId, actors.organizationOwner.userId],
    );

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
    const expiresAt = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const createProfile = async (sport) => {
      const response = await call('player', 'POST', '/api/sports-transfer/profiles', {
        sport, displayName: 'Mandate test ' + sport,
      });
      assert.equal(response.status, 201);
      return (await response.json()).profile;
    };
    const grantConsent = async (profileId, target, scope) => {
      const response = await call('player', 'POST', '/api/sports-transfer/profiles/' + profileId + '/consents', {
        ...target, purpose: 'representative_access', scope, expiresAt: expiresAt(),
      });
      assert.equal(response.status, 201, 'player must be able to grant purpose-specific representative access consent');
      return (await response.json()).consent;
    };
    const createMandate = async (profileId, target) => {
      const response = await call('player', 'POST', '/api/sports-transfer/profiles/' + profileId + '/mandates', {
        ...target,
        mandateType: 'agent',
        permittedActions: ['view_profile', 'contact_clubs', 'negotiate'],
        territoryCodes: ['NG'],
        expiresAt: expiresAt(),
      });
      return response;
    };

    const football = await createProfile('football');
    const basketball = await createProfile('basketball');

    const noConsent = await createMandate(football.id, { representativeUserId: actors.representative.userId });
    assert.equal(noConsent.status, 403, 'mandates cannot be created without prior representative-access consent');

    await grantConsent(football.id, { targetUserId: actors.representative.userId });
    const userMandateResponse = await createMandate(football.id, { representativeUserId: actors.representative.userId });
    assert.equal(userMandateResponse.status, 201);
    const userMandate = (await userMandateResponse.json()).mandate;
    assert.equal(userMandate.status, 'pending');
    assert.equal(userMandate.representative_response, 'pending');

    const duplicate = await createMandate(football.id, { representativeUserId: actors.representative.userId });
    assert.equal(duplicate.status, 409, 'a second live mandate for the same representative must be blocked');

    const outsiderList = await call('outsider', 'GET', '/api/sports-transfer/profiles/' + football.id + '/mandates');
    assert.equal(outsiderList.status, 404, 'mandate ledger is private to the player');
    const outsiderAccept = await call('outsider', 'POST', '/api/sports-transfer/mandates/' + userMandate.id + '/accept', {});
    assert.equal(outsiderAccept.status, 404, 'outsiders cannot respond to a mandate');
    const unauthorizedList = await call(null, 'GET', '/api/sports-transfer/mandates/mine');
    assert.equal(unauthorizedList.status, 401);

    const representativeInbox = await call('representative', 'GET', '/api/sports-transfer/mandates/mine');
    assert.equal(representativeInbox.status, 200);
    assert.equal((await representativeInbox.json()).mandates.length, 1);

    const accepted = await call('representative', 'POST', '/api/sports-transfer/mandates/' + userMandate.id + '/accept', {
      note: 'I accept the stated representation scope.',
    });
    assert.equal(accepted.status, 201);
    const acceptedMandate = (await accepted.json()).mandate;
    assert.equal(acceptedMandate.status, 'pending', 'acceptance must not activate an unverified mandate');
    assert.equal(acceptedMandate.representative_response, 'accepted');

    const playerLedger = await call('player', 'GET', '/api/sports-transfer/profiles/' + football.id + '/mandates');
    assert.equal(playerLedger.status, 200);
    assert.equal((await playerLedger.json()).mandates[0].representative_response, 'accepted');

    await grantConsent(football.id, { targetOrganizationId: organizationId });
    const orgMandateResponse = await createMandate(football.id, { representativeOrganizationId: organizationId });
    assert.equal(orgMandateResponse.status, 201);
    const orgMandate = (await orgMandateResponse.json()).mandate;
    const orgOutsiderAccept = await call('outsider', 'POST', '/api/sports-transfer/mandates/' + orgMandate.id + '/accept', {});
    assert.equal(orgOutsiderAccept.status, 404, 'only an active organization owner/admin can accept an organization mandate');
    const orgAccepted = await call('organizationOwner', 'POST', '/api/sports-transfer/mandates/' + orgMandate.id + '/accept', {});
    assert.equal(orgAccepted.status, 201);
    assert.equal((await orgAccepted.json()).mandate.representative_response, 'accepted');
    for (const actor of ['organizationOwner', 'organizationAdmin']) {
      const inbox = await call(actor, 'GET', '/api/sports-transfer/mandates/mine');
      assert.equal(inbox.status, 200);
      assert.ok((await inbox.json()).mandates.some((mandate) => mandate.id === orgMandate.id), actor + ' can see an organization mandate');
    }
    for (const actor of ['organizationMember', 'expiredAdmin', 'futureAdmin', 'outsider']) {
      const inbox = await call(actor, 'GET', '/api/sports-transfer/mandates/mine');
      assert.equal(inbox.status, 200);
      assert.ok(!(await inbox.json()).mandates.some((mandate) => mandate.id === orgMandate.id), actor + ' cannot see an organization mandate');
    }

    await grantConsent(basketball.id, { targetUserId: actors.representative2.userId });
    const rejectedMandateResponse = await createMandate(basketball.id, { representativeUserId: actors.representative2.userId });
    assert.equal(rejectedMandateResponse.status, 201);
    const rejectedMandate = (await rejectedMandateResponse.json()).mandate;
    const rejected = await call('representative2', 'POST', '/api/sports-transfer/mandates/' + rejectedMandate.id + '/reject', {
      note: 'I cannot take on this representation.',
    });
    assert.equal(rejected.status, 201);
    assert.equal((await rejected.json()).mandate.status, 'rejected');

    await grantConsent(basketball.id, { targetUserId: actors.representative3.userId }, { territoryCodes: ['NG'] });
    const revokeMandateResponse = await createMandate(basketball.id, { representativeUserId: actors.representative3.userId });
    assert.equal(revokeMandateResponse.status, 201);
    const revokeMandate = (await revokeMandateResponse.json()).mandate;
    const revoked = await call('player', 'POST', '/api/sports-transfer/mandates/' + revokeMandate.id + '/revoke', {
      note: 'I am changing my representation arrangements.',
    });
    assert.equal(revoked.status, 201);
    assert.equal((await revoked.json()).mandate.status, 'revoked');
    const representativeAfterRevoke = await call('representative3', 'GET', '/api/sports-transfer/mandates/mine');
    assert.equal(representativeAfterRevoke.status, 200);
    assert.equal((await representativeAfterRevoke.json()).mandates[0].effective_status, 'revoked');

    const badScope = await call('player', 'POST', '/api/sports-transfer/profiles/' + basketball.id + '/mandates', {
      representativeUserId: actors.representative3.userId,
      mandateType: 'agent',
      permittedActions: ['negotiate'],
      territoryCodes: ['GH'],
      expiresAt: expiresAt(),
    });
    assert.equal(badScope.status, 403, 'mandate scope cannot exceed the explicit consent scope');

    const audit = await pool.query(
      "SELECT event_type FROM audit_events WHERE entity_type = 'sports_representative_mandate' AND entity_id = ANY($1::uuid[])",
      [[userMandate.id, orgMandate.id, rejectedMandate.id, revokeMandate.id]],
    );
    const events = audit.rows.map(row => row.event_type);
    assert.ok(events.includes('sports.mandate.created'));
    assert.ok(events.includes('sports.mandate.accepted'));
    assert.ok(events.includes('sports.mandate.rejected'));
    assert.ok(events.includes('sports.mandate.revoked'));

    const notices = await pool.query(
      "SELECT title FROM user_notifications WHERE user_id = $1 AND title LIKE 'Sports Transfer mandate%'",
      [actors.player.userId],
    );
    assert.ok(notices.rowCount >= 2, 'the player receives mandate response notifications');

    console.log('Sports Transfer representative mandate HTTP integration tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Sports Transfer mandate API test failed:', error);
  process.exitCode = 1;
});
