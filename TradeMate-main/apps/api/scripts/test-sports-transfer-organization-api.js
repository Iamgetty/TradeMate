const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Sports Transfer organization API tests.');
  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 4,
  });
  let app;
  try {
    const suffix = randomUUID();
    const actors = {};
    for (const role of ['owner', 'member', 'admin', 'expiredAdmin', 'futureAdmin', 'outsider', 'secondMember']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Sports org test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'sports-org-' + role + '-' + suffix;
      await rawPool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [userId, tokenHash(token)],
      );
      actors[role] = { userId, token };
    }

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

    const unauthenticated = await call(null, 'GET', '/api/sports-transfer/organizations/mine');
    assert.equal(unauthenticated.status, 401);

    const create = await call('owner', 'POST', '/api/sports-transfer/organizations', {
      entityType: 'club',
      legalName: 'Sports Test Club ' + suffix,
      displayName: 'Sports Test Club',
      countryCode: 'NG',
      governingBody: 'Test Football Association',
    });
    assert.equal(create.status, 201);
    const organization = (await create.json()).organization;
    assert.equal(organization.verification_status, 'unverified');
    assert.equal(organization.membership.role, 'owner');
    assert.equal(organization.membership.status, 'active');
    const organizationId = organization.id;
    const ownerMembershipId = organization.membership.id;
    await rawPool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at, expires_at) VALUES ($1, $2, 'admin', 'workspace', 'active', $3, now() - interval '2 days', now() - interval '1 day')",
      [organizationId, actors.expiredAdmin.userId, actors.owner.userId],
    );
    await rawPool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1, $2, 'admin', 'workspace', 'active', $3, now() + interval '1 day')",
      [organizationId, actors.futureAdmin.userId, actors.owner.userId],
    );

    const mine = await call('owner', 'GET', '/api/sports-transfer/organizations/mine');
    assert.equal(mine.status, 200);
    assert.equal((await mine.json()).organizations.length, 1);

    const inviteBody = {
      userId: actors.member.userId,
      role: 'recruiter',
      permissionScope: 'recruitment',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const invite = await call('owner', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', inviteBody);
    assert.equal(invite.status, 201);
    const membership = (await invite.json()).membership;
    assert.equal(membership.status, 'invited');
    assert.equal(membership.permission_scope, 'recruitment');
    const inviteNotification = await rawPool.query(
      "SELECT id FROM user_notifications WHERE user_id = $1 AND title = 'Sporting organization invitation'",
      [actors.member.userId],
    );
    assert.equal(inviteNotification.rowCount, 1, 'the invitee receives an in-app invitation notification');
    const duplicateInvite = await call('owner', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', inviteBody);
    assert.equal(duplicateInvite.status, 409, 'an unexpired invitation must not be duplicated');

    const outsiderList = await call('outsider', 'GET', '/api/sports-transfer/organizations/' + organizationId + '/members');
    assert.equal(outsiderList.status, 403);
    for (const actor of ['expiredAdmin', 'futureAdmin']) {
      const inactiveManagerList = await call(actor, 'GET', '/api/sports-transfer/organizations/' + organizationId + '/members');
      assert.equal(inactiveManagerList.status, 403, actor + ' cannot inspect organization membership outside the active date window');
      const inactiveManagerInvite = await call(actor, 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
        userId: actors.secondMember.userId,
        role: 'member',
        permissionScope: 'read_only',
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      });
      assert.equal(inactiveManagerInvite.status, 403, actor + ' cannot invite members outside the active date window');
    }
    const outsiderInvite = await call('outsider', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      ...inviteBody,
      userId: actors.secondMember.userId,
    });
    assert.equal(outsiderInvite.status, 403);

    const accepted = await call('member', 'POST', '/api/sports-transfer/memberships/' + membership.id + '/accept');
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).membership.status, 'active');
    const ownerNotification = await rawPool.query(
      "SELECT id FROM user_notifications WHERE user_id = $1 AND title = 'New sporting organization member'",
      [actors.owner.userId],
    );
    assert.equal(ownerNotification.rowCount, 1, 'organization owners are notified when an invite is accepted');
    for (const actor of ['expiredAdmin', 'futureAdmin']) {
      const inactiveManagerNotification = await rawPool.query(
        "SELECT id FROM user_notifications WHERE user_id = $1 AND title = 'New sporting organization member'",
        [actors[actor].userId],
      );
      assert.equal(inactiveManagerNotification.rowCount, 0, actor + ' is not notified outside the active membership date window');
    }
    const repeatedAccept = await call('member', 'POST', '/api/sports-transfer/memberships/' + membership.id + '/accept');
    assert.equal(repeatedAccept.status, 404);

    const memberList = await call('member', 'GET', '/api/sports-transfer/organizations/' + organizationId + '/members');
    assert.equal(memberList.status, 403);
    const memberInvite = await call('member', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      ...inviteBody,
      userId: actors.secondMember.userId,
    });
    assert.equal(memberInvite.status, 403);

    const adminInvite = await call('owner', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      userId: actors.admin.userId,
      role: 'admin',
      permissionScope: 'workspace',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(adminInvite.status, 201);
    const adminMembershipId = (await adminInvite.json()).membership.id;
    const adminAccepted = await call('admin', 'POST', '/api/sports-transfer/memberships/' + adminMembershipId + '/accept');
    assert.equal(adminAccepted.status, 201);

    const adminEscalation = await call('admin', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      userId: actors.secondMember.userId,
      role: 'admin',
      permissionScope: 'workspace',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(adminEscalation.status, 403, 'admins cannot invite other admins');

    const adminOwnerEscalation = await call('admin', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      userId: actors.secondMember.userId,
      role: 'owner',
      permissionScope: 'workspace',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(adminOwnerEscalation.status, 400, 'the invitation schema rejects owner assignment because ownership can only be established at organization creation');

    const adminInviteMember = await call('admin', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', {
      userId: actors.secondMember.userId,
      role: 'scout',
      permissionScope: 'read_only',
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    assert.equal(adminInviteMember.status, 201);
    const secondMembershipId = (await adminInviteMember.json()).membership.id;

    const adminCannotRevokeOwner = await call('admin', 'POST', '/api/sports-transfer/memberships/' + ownerMembershipId + '/revoke');
    assert.equal(adminCannotRevokeOwner.status, 403);

    const ownerRevoke = await call('owner', 'POST', '/api/sports-transfer/memberships/' + membership.id + '/revoke');
    assert.equal(ownerRevoke.status, 201);
    assert.equal((await ownerRevoke.json()).membership.status, 'revoked');
    const revokeNotification = await rawPool.query(
      "SELECT id FROM user_notifications WHERE user_id = $1 AND title = 'Sporting organization access updated'",
      [actors.member.userId],
    );
    assert.equal(revokeNotification.rowCount, 1, 'a removed member is notified about access revocation');

    const revokedMemberList = await call('member', 'GET', '/api/sports-transfer/organizations/' + organizationId + '/members');
    assert.equal(revokedMemberList.status, 403);

    const reinvite = await call('owner', 'POST', '/api/sports-transfer/organizations/' + organizationId + '/memberships', inviteBody);
    assert.equal(reinvite.status, 201, 'a revoked member can be invited again');
    assert.equal((await reinvite.json()).membership.id, membership.id, 're-invitation reuses the membership record');
    const reaccepted = await call('member', 'POST', '/api/sports-transfer/memberships/' + membership.id + '/accept');
    assert.equal(reaccepted.status, 201, 'the re-invited member can accept again');

    const ownerCanRevokeAdmin = await call('owner', 'POST', '/api/sports-transfer/memberships/' + adminMembershipId + '/revoke');
    assert.equal(ownerCanRevokeAdmin.status, 201);

    const audit = await rawPool.query(
      "SELECT event_type FROM audit_events WHERE entity_type IN ('sports_organization', 'sports_org_membership') AND entity_id IN ($1, $2, $3, $4) ORDER BY created_at",
      [organizationId, membership.id, adminMembershipId, secondMembershipId],
    );
    const types = audit.rows.map(row => row.event_type);
    assert.ok(types.includes('sports.organization.created'));
    assert.ok(types.includes('sports.organization.member_invited'));
    assert.ok(types.includes('sports.organization.invitation_accepted'));
    assert.ok(types.includes('sports.organization.membership_revoked'));

    console.log('Sports Transfer organization membership HTTP integration tests passed.');
  } finally {
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Sports Transfer organization API test failed:', error);
  process.exitCode = 1;
});
