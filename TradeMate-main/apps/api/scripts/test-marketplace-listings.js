const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for marketplace listing integration tests.');

  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 2,
  });
  let app;
  let triggerInstalled = false;

  try {
    const suffix = randomUUID();
    const organization = await rawPool.query(
      "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, 'business', 'NG', 'NGN', 'active') RETURNING id",
      ['Listing integration ' + suffix],
    );
    const organizationId = organization.rows[0].id;
    const actors = {};

    for (const role of ['owner', 'admin', 'member', 'outsider']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Listing test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'listing-test-' + role + '-' + suffix;
      await rawPool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')",
        [userId, tokenHash(token)],
      );
      actors[role] = { userId, token };
      if (['owner', 'admin', 'member'].includes(role)) {
        await rawPool.query(
          'INSERT INTO organization_members (organization_id, user_id, member_role) VALUES ($1, $2, $3)',
          [organizationId, userId, role],
        );
      }
    }

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const baseUrl = 'http://127.0.0.1:' + address.port;
    const createDraft = (role, title) => fetch(baseUrl + '/api/market/listings', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors[role].token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title,
        description: 'Integration-test Services offer',
        listingType: 'service',
        price: '100.00',
        quantityAvailable: '2',
      }),
    });

    const createdDrafts = {};
    for (const role of ['owner', 'admin', 'member']) {
      const response = await createDraft(role, 'Draft ' + role + ' ' + suffix);
      assert.equal(response.status, 201, role + ' organization member should be allowed to create a draft under the current membership policy');
      const payload = await response.json();
      assert.equal(payload.listing.status, 'draft');
      createdDrafts[role] = payload.listing;
      const audit = await rawPool.query(
        "SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'listing.draft_created' AND entity_id = $1",
        [payload.listing.id],
      );
      assert.equal(audit.rows[0].count, 1, 'successful draft creation must have exactly one audit event');
    }

    const outsider = await createDraft('outsider', 'Outsider draft ' + suffix);
    assert.equal(outsider.status, 400, 'an unrelated account must not create a draft in another organization');

    const before = await rawPool.query(
      "SELECT count(*)::int AS count FROM listings WHERE seller_organization_id = $1 AND title LIKE 'Rollback draft %'",
      [organizationId],
    );
    await rawPool.query(`
      CREATE OR REPLACE FUNCTION test_reject_listing_draft_audit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type IN ('listing.draft_created', 'listing.draft_updated', 'listing.draft_deleted') THEN
          RAISE EXCEPTION 'forced listing audit insert failure for rollback test';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await rawPool.query(`
      CREATE TRIGGER test_reject_listing_draft_audit_trigger
      BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION test_reject_listing_draft_audit();
    `);
    triggerInstalled = true;

    const updateFailed = await fetch(baseUrl + '/api/market/listings/' + createdDrafts.owner.id, {
      method: 'PATCH',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.owner.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Edited draft ' + suffix,
        description: 'Integration-test Services offer',
        listingType: 'service',
        price: '100.00',
        quantityAvailable: null,
      }),
    });
    assert.equal(updateFailed.status, 500, 'forced audit failure must fail draft update');
    const unchanged = await rawPool.query('SELECT title FROM listings WHERE id = $1', [createdDrafts.owner.id]);
    assert.equal(unchanged.rows[0]?.title, createdDrafts.owner.title,
      'draft edits must roll back when the matching audit insert fails');

    const deleteFailed = await fetch(baseUrl + '/api/market/listings/' + createdDrafts.admin.id, {
      method: 'DELETE',
      headers: { cookie: 'trademate_session=' + encodeURIComponent(actors.admin.token) },
    });
    assert.equal(deleteFailed.status, 500, 'forced audit failure must fail draft deletion');
    const retained = await rawPool.query('SELECT id FROM listings WHERE id = $1', [createdDrafts.admin.id]);
    assert.equal(retained.rowCount, 1,
      'draft deletion must roll back when the matching audit insert fails');

    const failed = await createDraft('owner', 'Rollback draft ' + suffix);
    assert.equal(failed.status, 500, 'forced audit failure must fail draft creation');
    const after = await rawPool.query(
      "SELECT count(*)::int AS count FROM listings WHERE seller_organization_id = $1 AND title LIKE 'Rollback draft %'",
      [organizationId],
    );
    assert.equal(after.rows[0].count, before.rows[0].count,
      'draft rows must roll back when the matching audit insert fails');

    console.log('Services/B2B draft create, edit and delete authorization and atomic audit rollback integration tests passed.');
  } finally {
    if (triggerInstalled) {
      await rawPool.query('DROP TRIGGER IF EXISTS test_reject_listing_draft_audit_trigger ON audit_events').catch(() => undefined);
      await rawPool.query('DROP FUNCTION IF EXISTS test_reject_listing_draft_audit()').catch(() => undefined);
    }
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Marketplace listing integration test failed:', error);
  process.exitCode = 1;
});
