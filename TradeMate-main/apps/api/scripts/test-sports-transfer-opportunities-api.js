const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for Sports Transfer opportunity API tests.');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 4,
  });
  let app;
  try {
    const suffix = randomUUID();
    const actors = {};
    for (const role of ['player','recruiter','outsider']) {
      const user = await pool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Opportunity test ' + role],
      );
      const token = 'sports-opportunity-' + role + '-' + suffix;
      await pool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [user.rows[0].id, tokenHash(token)],
      );
      actors[role] = { userId: user.rows[0].id, token };
    }

    const profile = await pool.query(
      "INSERT INTO sports_profiles (user_id, sport, display_name) VALUES ($1, 'football', 'Opportunity test player') RETURNING id",
      [actors.player.userId],
    );
    const basketballProfile = await pool.query(
      "INSERT INTO sports_profiles (user_id, sport, display_name) VALUES ($1, 'basketball', 'Opportunity test basketball player') RETURNING id",
      [actors.player.userId],
    );
    const org = await pool.query(
      "INSERT INTO sports_organizations (entity_type, legal_name, display_name, country_code, created_by_user_id) VALUES ('club', $1, 'Opportunity Test Club', 'NG', $2) RETURNING id",
      ['Opportunity Test Club ' + suffix, actors.player.userId],
    );
    await pool.query(
      "INSERT INTO sports_org_memberships (sports_organization_id, user_id, role, permission_scope, status, invited_by_user_id, starts_at) VALUES ($1,$2,'recruiter','recruitment','active',$2,now())",
      [org.rows[0].id, actors.recruiter.userId],
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

    const playerDraft = await call('player','POST','/api/sports-transfer/opportunities',{
      sport:'football', movementType:'loan', playerProfileId:profile.rows[0].id,
      title:'Available for a season loan', opportunityDirection:'available',
      financialTerms:{type:'negotiable'}, visibility:'private',
    });
    assert.equal(playerDraft.status,201);
    const playerResult = (await playerDraft.json()).opportunity;
    assert.equal(playerResult.status,'draft');
    assert.equal(playerResult.financial_terms.type,'negotiable');

    const basketballDraft = await call('player','POST','/api/sports-transfer/opportunities',{
      sport:'basketball', movementType:'contract_renewal', playerProfileId:basketballProfile.rows[0].id,
      title:'Basketball contract renewal', opportunityDirection:'available',
      financialTerms:{type:'not_applicable'},
    });
    assert.equal(basketballDraft.status,201, 'basketball contract renewal is a supported basketball movement');

    const invalidSportMovement = await call('player','POST','/api/sports-transfer/opportunities',{
      sport:'football', movementType:'player_trade', playerProfileId:profile.rows[0].id,
      title:'Invalid cross-sport movement', opportunityDirection:'available',
    });
    assert.equal(invalidSportMovement.status,400);

    const recruiterDraft = await call('recruiter','POST','/api/sports-transfer/opportunities',{
      sport:'football', movementType:'permanent_transfer', sportingOrganizationId:org.rows[0].id,
      title:'Recruitment requirement', opportunityDirection:'seeking',
      financialTerms:{type:'undisclosed'},
    });
    assert.equal(recruiterDraft.status,201);
    const orgResult = (await recruiterDraft.json()).opportunity;
    assert.equal(orgResult.status,'draft');
    assert.equal(orgResult.sporting_organization_id,org.rows[0].id);

    const outsiderOrg = await call('outsider','POST','/api/sports-transfer/opportunities',{
      sport:'football', movementType:'loan', sportingOrganizationId:org.rows[0].id,
      title:'Unauthorized recruitment requirement', opportunityDirection:'seeking',
    });
    assert.equal(outsiderOrg.status,403);

    const outsiderProfile = await call('outsider','POST','/api/sports-transfer/opportunities',{
      sport:'football', movementType:'loan', playerProfileId:profile.rows[0].id,
      title:'Unauthorized player opportunity', opportunityDirection:'available',
    });
    assert.equal(outsiderProfile.status,404);

    const mine = await call('player','GET','/api/sports-transfer/opportunities/mine');
    assert.equal(mine.status,200);
    const mineRows = (await mine.json()).opportunities;
    assert.ok(mineRows.some(row => row.id === playerResult.id));
    assert.ok(!mineRows.some(row => row.id === orgResult.id), 'player cannot see an unrelated organization opportunity');

    const recruiterMine = await call('recruiter','GET','/api/sports-transfer/opportunities/mine');
    assert.ok((await recruiterMine.json()).opportunities.some(row => row.id === orgResult.id));
    await pool.query("UPDATE sports_org_memberships SET status='revoked', updated_at=now() WHERE sports_organization_id=$1 AND user_id=$2", [org.rows[0].id, actors.recruiter.userId]);
    const recruiterAfterRevocation = await call('recruiter','GET','/api/sports-transfer/opportunities/mine');
    assert.ok(!(await recruiterAfterRevocation.json()).opportunities.some(row => row.id === orgResult.id), 'revoked organization members lose draft access');
    const outsiderMine = await call('outsider','GET','/api/sports-transfer/opportunities/mine');
    assert.equal((await outsiderMine.json()).opportunities.length,0);
    const unauthenticated = await call(null,'GET','/api/sports-transfer/opportunities/mine');
    assert.equal(unauthenticated.status,401);

    const audit = await pool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE event_type='sports.opportunity.draft_created' AND entity_id = ANY($1::uuid[])",
      [[playerResult.id,orgResult.id]],
    );
    assert.equal(audit.rows[0].count,2);

    console.log('Sports Transfer opportunity draft HTTP integration tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Sports Transfer opportunity API test failed:', error);
  process.exitCode = 1;
});
