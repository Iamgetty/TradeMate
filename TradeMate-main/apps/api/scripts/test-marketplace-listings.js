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

    const reviewKey = 'listing-review-test-' + suffix;
    process.env.TRADEMATE_REVIEW_API_KEY = reviewKey;

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const baseUrl = 'http://127.0.0.1:' + address.port;
    const createDraft = (role, title, quantityAvailable = null, listingType = 'service') => fetch(baseUrl + '/api/market/listings', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors[role].token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title,
        description: 'Integration-test Services offer',
        listingType,
        price: '100.00',
        quantityAvailable,
      }),
    });

    const reviewCall = (method, path, body) => fetch(baseUrl + path, {
      method,
      headers: {
        'x-review-key': reviewKey,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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


    // Exercise the distinct B2B inventory path from draft through moderation and public discovery.
    const b2bTitle = 'B2B lifecycle ' + suffix;
    const b2bDraftResponse = await createDraft('member', b2bTitle, 25, 'b2b');
    assert.equal(b2bDraftResponse.status, 201, 'an organization member may create a B2B draft under the existing membership policy');
    const b2bDraft = (await b2bDraftResponse.json()).listing;
    assert.equal(b2bDraft.listing_type, 'b2b', 'B2B must persist as its own listing type');
    assert.equal(Number(b2bDraft.quantity_available), 25, 'B2B inventory quantity must persist');
    const memberOffers = await fetch(baseUrl + '/api/market/listings/mine', {
      headers: { cookie: 'trademate_session=' + encodeURIComponent(actors.member.token) },
    });
    assert.equal(memberOffers.status, 200);
    assert.ok((await memberOffers.json()).data.some((offer) => offer.id === b2bDraft.id),
      'the creating organization member must see the B2B draft in their own offers');

    const outsiderSubmit = await fetch(baseUrl + '/api/market/listings/' + b2bDraft.id + '/submit', {
      method: 'POST',
      headers: { cookie: 'trademate_session=' + encodeURIComponent(actors.outsider.token) },
    });
    assert.equal(outsiderSubmit.status, 404, 'an unrelated account must not submit another organization’s B2B draft');

    const submitB2b = await fetch(baseUrl + '/api/market/listings/' + b2bDraft.id + '/submit', {
      method: 'POST',
      headers: { cookie: 'trademate_session=' + encodeURIComponent(actors.member.token) },
    });
    assert.equal(submitB2b.status, 201, 'an organization member may submit a B2B draft under the existing membership policy');
    assert.equal((await submitB2b.json()).listing.status, 'pending_review');
    const submitAudit = await rawPool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'listing.submitted_for_review' AND entity_id = $1",
      [b2bDraft.id],
    );
    assert.equal(submitAudit.rows[0].count, 1, 'B2B submission must write exactly one audit event');

    const hiddenB2b = await fetch(baseUrl + '/api/market/listings?type=b2b&q=' + encodeURIComponent(b2bTitle));
    assert.equal(hiddenB2b.status, 200);
    assert.ok(!(await hiddenB2b.json()).data.some((offer) => offer.id === b2bDraft.id),
      'a B2B offer pending moderation must not be publicly discoverable');

    const deniedQueue = await fetch(baseUrl + '/api/moderation/listings');
    assert.equal(deniedQueue.status, 401, 'the moderation queue must require its reviewer credential');
    const queue = await reviewCall('GET', '/api/moderation/listings');
    assert.equal(queue.status, 200, 'an authorized reviewer must be able to inspect the listing queue');
    assert.ok((await queue.json()).data.some((offer) => offer.id === b2bDraft.id),
      'the submitted B2B offer must appear in the moderation queue');

    const approvedB2b = await reviewCall('POST', '/api/moderation/listings/' + b2bDraft.id + '/review', {
      decision: 'approved',
      note: 'Integration test approval.',
    });
    assert.equal(approvedB2b.status, 201, 'an authorized reviewer must be able to approve the B2B offer');
    assert.equal((await approvedB2b.json()).listing.status, 'published');
    const reviewAudit = await rawPool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'listing.reviewed' AND entity_id = $1",
      [b2bDraft.id],
    );
    assert.equal(reviewAudit.rows[0].count, 1, 'B2B moderation must write exactly one review audit event');

    const publicB2b = await fetch(baseUrl + '/api/market/listings?type=b2b&q=' + encodeURIComponent(b2bTitle));
    assert.equal(publicB2b.status, 200);
    const publicB2bPayload = await publicB2b.json();
    assert.ok(publicB2bPayload.data.some((offer) => offer.id === b2bDraft.id),
      'an approved B2B offer must appear in public discovery');
    const b2bDetail = await fetch(baseUrl + '/api/market/listings/' + b2bDraft.id);
    assert.equal(b2bDetail.status, 200, 'an approved B2B offer must have a public detail view');

    const b2bEnquiry = await fetch(baseUrl + '/api/market/enquiries', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.outsider.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        listingId: b2bDraft.id,
        message: 'Please share the next steps for this B2B offer.',
      }),
    });
    assert.equal(b2bEnquiry.status, 201, 'a different account must be able to enquire about a published B2B offer');
    const b2bEnquiryPayload = await b2bEnquiry.json();
    assert.equal(b2bEnquiryPayload.data.listing_id, b2bDraft.id);
    const b2bEnquiryAudit = await rawPool.query(
      "SELECT count(*)::int AS count FROM audit_events WHERE event_type = 'marketplace.enquiry_created' AND entity_id = $1",
      [b2bEnquiryPayload.data.id],
    );
    assert.equal(b2bEnquiryAudit.rows[0].count, 1, 'B2B enquiry creation must write exactly one audit event');
    const enquiryUrl = '/messages/' + b2bEnquiryPayload.data.id;
    const initialNotifications = await rawPool.query(
      'SELECT user_id, title, action_url FROM user_notifications WHERE action_url = $1 ORDER BY user_id',
      [enquiryUrl],
    );
    assert.deepEqual(initialNotifications.rows.map((row) => row.user_id).sort(),
      [actors.owner.userId, actors.admin.userId].sort(),
      'new enquiries must notify seller owners/admins only, with a direct conversation link');

    const sellerReply = await fetch(baseUrl + '/api/market/enquiries/' + b2bEnquiryPayload.data.id + '/messages', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.owner.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'Thank you. We can share the delivery schedule.' }),
    });
    assert.equal(sellerReply.status, 201, 'an authorized seller owner must be able to reply to an enquiry');
    const buyerReplyNotice = await rawPool.query(
      'SELECT title, action_url FROM user_notifications WHERE user_id = $1 AND action_url = $2',
      [actors.outsider.userId, enquiryUrl],
    );
    assert.equal(buyerReplyNotice.rowCount, 1, 'a seller reply must notify the buyer with a conversation link');

    const buyerReply = await fetch(baseUrl + '/api/market/enquiries/' + b2bEnquiryPayload.data.id + '/messages', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.outsider.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: 'Please send the schedule and proposed milestones.' }),
    });
    assert.equal(buyerReply.status, 201, 'the buyer must be able to continue the enquiry conversation');
    const sellerReplyNotices = await rawPool.query(
      'SELECT user_id FROM user_notifications WHERE action_url = $1 AND title = $2 ORDER BY user_id',
      [enquiryUrl, 'New enquiry reply'],
    );
    assert.deepEqual(sellerReplyNotices.rows.map((row) => row.user_id).sort(),
      [actors.owner.userId, actors.admin.userId, actors.outsider.userId].sort(),
      'buyer replies must notify seller owners/admins while seller replies notify the buyer');
    const memberNotice = await rawPool.query(
      'SELECT count(*)::int AS count FROM user_notifications WHERE user_id = $1 AND action_url = $2',
      [actors.member.userId, enquiryUrl],
    );
    assert.equal(memberNotice.rows[0].count, 0, 'ordinary seller members must not receive owner/admin enquiry notifications');

    const invalidServiceQuantity = await createDraft('owner', 'Invalid service quantity ' + suffix, 3);
    assert.equal(invalidServiceQuantity.status, 400, 'service offers must reject inventory quantities during draft creation');
    const invalidServiceRows = await rawPool.query(
      "SELECT count(*)::int AS count FROM listings WHERE seller_organization_id = $1 AND title = $2",
      [organizationId, 'Invalid service quantity ' + suffix],
    );
    assert.equal(invalidServiceRows.rows[0].count, 0, 'invalid service quantity must not create a draft');

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
        IF NEW.event_type IN ('listing.draft_created', 'listing.draft_updated', 'listing.draft_deleted', 'organization.updated', 'marketplace.enquiry_created') THEN
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

    const organizationUpdateFailed = await fetch(baseUrl + '/api/organizations/' + organizationId, {
      method: 'PATCH',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.owner.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Changed organization ' + suffix }),
    });
    assert.equal(organizationUpdateFailed.status, 500, 'forced audit failure must fail organization profile update');
    const organizationUnchanged = await rawPool.query('SELECT name FROM organizations WHERE id = $1', [organizationId]);
    assert.equal(organizationUnchanged.rows[0]?.name, 'Listing integration ' + suffix,
      'organization profile changes must roll back when the audit insert fails');

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

    await rawPool.query("UPDATE listings SET status = 'published' WHERE id = $1", [createdDrafts.owner.id]);
    const enquiryFailed = await fetch(baseUrl + '/api/market/enquiries', {
      method: 'POST',
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors.outsider.token),
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        listingId: createdDrafts.owner.id,
        message: 'Integration test enquiry for atomic audit rollback.',
      }),
    });
    assert.equal(enquiryFailed.status, 500, 'forced audit failure must fail enquiry creation');
    const enquiryRows = await rawPool.query(
      'SELECT count(*)::int AS count FROM marketplace_enquiries WHERE listing_id = $1 AND buyer_user_id = $2',
      [createdDrafts.owner.id, actors.outsider.userId],
    );
    assert.equal(enquiryRows.rows[0].count, 0, 'enquiry rows must roll back when the matching audit insert fails');
    const rolledBackNotifications = await rawPool.query(
      'SELECT count(*)::int AS count FROM user_notifications WHERE body = $1 AND user_id = ANY($2::uuid[])',
      ['A buyer enquired about Draft owner ' + suffix + '.', [actors.owner.userId, actors.admin.userId]],
    );
    assert.equal(rolledBackNotifications.rows[0].count, 0,
      'failed enquiry creation must not leave notification rows behind');

    console.log('Services/B2B organization profile, draft lifecycle and enquiry authorization and atomic audit rollback integration tests passed.');
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
