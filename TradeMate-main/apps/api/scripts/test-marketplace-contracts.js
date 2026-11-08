const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for marketplace contract integration tests.');

  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 2,
  });
  let app;

  try {
    const suffix = randomUUID();
    const org = await rawPool.query(
      "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, 'business', 'NG', 'NGN', 'active') RETURNING id",
      ['Contract integration ' + suffix],
    );
    const organizationId = org.rows[0].id;
    const actors = {};

    for (const role of ['buyer', 'owner', 'admin', 'member', 'outsider']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Contract test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'contract-test-' + role + '-' + suffix;
      await rawPool.query(
        'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\')',
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

    const listing = await rawPool.query(
      "INSERT INTO listings (seller_organization_id, title, description, listing_type, price_minor_units, currency_code, country_code, status) VALUES ($1, $2, 'Integration test service offer', 'service', 10000, 'NGN', 'NG', 'published') RETURNING id",
      [organizationId, 'Contract offer ' + suffix],
    );
    const listingId = listing.rows[0].id;

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
        cookie: 'trademate_session=' + encodeURIComponent(actors[actor].token),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const createContract = async () => {
      const response = await call('buyer', 'POST', '/api/market/contracts', {
        listingId,
        amount: '100.00',
        scope: 'Deliver the agreed integration service.',
        terms: 'Payment is due after both parties confirm fulfilment.',
      });
      assert.equal(response.status, 201, 'buyer must be able to create a contract proposal');
      return (await response.json()).data.id;
    };
    const respond = (actor, id, decision) =>
      call(actor, 'PATCH', '/api/market/contracts/' + id + '/respond', { decision });
    const confirm = (actor, id) =>
      call(actor, 'PATCH', '/api/market/contracts/' + id + '/confirm-completion');

    const completionId = await createContract();
    const outsiderRead = await call('outsider', 'GET', '/api/market/contracts/' + completionId);
    assert.equal(outsiderRead.status, 404, 'unrelated accounts must not read a contract');

    const buyerMessage = await call('buyer', 'POST', '/api/market/contracts/' + completionId + '/messages', {
      message: 'Please confirm the delivery milestones before we begin.',
    });
    assert.equal(buyerMessage.status, 201, 'the buyer must be able to message a pending contract');
    const sellerMessageList = await call('owner', 'GET', '/api/market/contracts/' + completionId + '/messages');
    assert.equal(sellerMessageList.status, 200, 'the seller must be able to read contract messages');
    const sellerMessagePayload = await sellerMessageList.json();
    assert.equal(sellerMessagePayload.data.messages.length, 1, 'the buyer message must be visible to the seller');
    assert.equal(sellerMessagePayload.data.messages[0].message, 'Please confirm the delivery milestones before we begin.');

    const memberMessage = await call('member', 'POST', '/api/market/contracts/' + completionId + '/messages', {
      message: 'I am an organization member coordinating this service.',
    });
    assert.equal(memberMessage.status, 201, 'an authorized seller organization member must be able to participate in contract messages');
    const outsiderMessages = await call('outsider', 'GET', '/api/market/contracts/' + completionId + '/messages');
    assert.equal(outsiderMessages.status, 404, 'unrelated accounts must not read contract messages');
    const buyerMessageList = await call('buyer', 'GET', '/api/market/contracts/' + completionId + '/messages');
    assert.equal(buyerMessageList.status, 200);
    const buyerMessagePayload = await buyerMessageList.json();
    assert.equal(buyerMessagePayload.data.messages.length, 2, 'both parties must see the complete contract conversation');
    const buyerRespond = await respond('buyer', completionId, 'accept');
    assert.equal(buyerRespond.status, 404, 'buyer must not approve their own proposal');
    const memberRespond = await respond('member', completionId, 'accept');
    assert.equal(memberRespond.status, 404, 'ordinary seller members must not approve proposals');

    const accepted = await respond('owner', completionId, 'accept');
    assert.equal(accepted.status, 200, 'seller owner must be able to accept');
    assert.equal((await accepted.json()).data.status, 'accepted');

    const buyerConfirmed = await confirm('buyer', completionId);
    assert.equal(buyerConfirmed.status, 200);
    assert.equal((await buyerConfirmed.json()).data.status, 'accepted',
      'one party confirmation must not complete the contract');
    const sellerConfirmed = await confirm('owner', completionId);
    assert.equal(sellerConfirmed.status, 200);
    assert.equal((await sellerConfirmed.json()).data.status, 'completed',
      'both parties confirming must complete the contract');
    const closedMessage = await call('buyer', 'POST', '/api/market/contracts/' + completionId + '/messages', {
      message: 'This message must be rejected after completion.',
    });
    assert.equal(closedMessage.status, 409, 'completed contracts must reject new messages');

    const rejectedId = await createContract();
    const rejected = await respond('admin', rejectedId, 'reject');
    assert.equal(rejected.status, 200, 'seller admin must be able to reject');
    assert.equal((await rejected.json()).data.status, 'rejected');

    const cancelledId = await createContract();
    const cancelled = await call('buyer', 'PATCH', '/api/market/contracts/' + cancelledId + '/cancel');
    assert.equal(cancelled.status, 200, 'buyer must be able to cancel a pending proposal');
    assert.equal((await cancelled.json()).data.status, 'cancelled');
    const respondAfterCancel = await respond('owner', cancelledId, 'accept');
    assert.equal(respondAfterCancel.status, 409, 'cancelled proposals must not be accepted');

    const concurrentId = await createContract();
    const outcomes = await Promise.all([
      respond('owner', concurrentId, 'accept'),
      respond('admin', concurrentId, 'reject'),
    ]);
    const statuses = outcomes.map((response) => response.status).sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 409],
      'row locking must allow exactly one concurrent seller decision');

    console.log('Two-account contract authorization, decision, cancellation, mutual fulfilment and concurrency tests passed.');
  } finally {
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Marketplace contract integration test failed:', error);
  process.exitCode = 1;
});
