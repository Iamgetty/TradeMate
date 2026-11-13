const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for P2P lifecycle integration tests.');

  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 4,
  });
  let app;

  try {
    const suffix = randomUUID();
    const actors = {};

    for (const role of ['seller', 'buyer', 'other']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'P2P test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'p2p-test-' + role + '-' + suffix;
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
      ...(actor ? { headers: { cookie: 'trademate_session=' + encodeURIComponent(actors[actor].token), ...(body ? { 'content-type': 'application/json' } : {}) } } : {}),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const createAd = async (side = 'sell', quantity = '5') => {
      const response = await call('seller', 'POST', '/api/p2p/ads', {
        side, asset: 'USDT', fiat: 'NGN', price: '1000.00', quantity,
        minFiatAmount: '1000.00', maxFiatAmount: String(Number(quantity) * 1000),
        paymentMethods: ['Bank transfer'],
      });
      assert.equal(response.status, 201, 'seller must be able to create a P2P advertisement');
      return (await response.json()).ad;
    };
    const placeOrder = (actor, adId, fiatAmount = '1000.00') =>
      call(actor, 'POST', '/api/p2p/orders', { adId, fiatAmount });

    const publicBook = await call(null, 'GET', '/api/p2p/book?asset=USDT&fiat=NGN');
    assert.equal(publicBook.status, 200, 'the P2P book must be public');
    const privateWithoutSession = await call(null, 'GET', '/api/p2p/my-orders');
    assert.equal(privateWithoutSession.status, 401, 'private P2P orders must require a session');

    const ownAd = await createAd();
    const ownTrade = await placeOrder('seller', ownAd.id);
    assert.equal(ownTrade.status, 400, 'a user must not trade against their own advertisement');

    const cancelAd = await createAd('sell', '5');
    const cancelOrderResponse = await placeOrder('buyer', cancelAd.id, '2000.00');
    assert.equal(cancelOrderResponse.status, 201, 'a second user must be able to reserve an advertised quantity');
    const cancelOrder = (await cancelOrderResponse.json()).order;
    assert.equal(cancelOrder.quantity, '2.000000000000', 'the reserved quantity must match the trade amount');
    const cancelled = await call('buyer', 'POST', '/api/p2p/orders/' + cancelOrder.id + '/cancel');
    assert.equal(cancelled.status, 201, 'the buyer must be able to cancel an unpaid order');
    const restoredBook = await call(null, 'GET', '/api/p2p/book?asset=USDT&fiat=NGN');
    const restored = (await restoredBook.json()).data.find((ad) => ad.id === cancelAd.id);
    assert.equal(restored.quantity, '5.000000000000', 'unpaid cancellation must restore the reserved advertisement quantity');

    const completedAd = await createAd('sell', '5');
    const completedResponse = await placeOrder('buyer', completedAd.id, '2000.00');
    assert.equal(completedResponse.status, 201);
    const completedOrder = (await completedResponse.json()).order;
    const paymentSent = await call('buyer', 'POST', '/api/p2p/orders/' + completedOrder.id + '/payment-sent', { reference: 'TEST-REFERENCE' });
    assert.equal(paymentSent.status, 201, 'buyer must be able to mark payment sent');
    const duplicatePaymentSent = await call('buyer', 'POST', '/api/p2p/orders/' + completedOrder.id + '/payment-sent', { reference: 'TEST-REFERENCE' });
    assert.equal(duplicatePaymentSent.status, 409, 'payment-sent transition must not be replayed');
    const buyerCannotConfirm = await call('buyer', 'POST', '/api/p2p/orders/' + completedOrder.id + '/confirm-receipt');
    assert.equal(buyerCannotConfirm.status, 409, 'only the seller may confirm receipt');
    const sellerConfirmed = await call('seller', 'POST', '/api/p2p/orders/' + completedOrder.id + '/confirm-receipt');
    assert.equal(sellerConfirmed.status, 201, 'seller must be able to confirm receipt after buyer payment-sent');
    const sellerCannotConfirmAgain = await call('seller', 'POST', '/api/p2p/orders/' + completedOrder.id + '/confirm-receipt');
    assert.equal(sellerCannotConfirmAgain.status, 409, 'completed trade cannot be completed twice');

    const publicTrades = await call(null, 'GET', '/api/p2p/trades?asset=USDT&fiat=NGN');
    assert.equal(publicTrades.status, 200);
    const publicTradePayload = await publicTrades.json();
    assert.ok(publicTradePayload.data.some((trade) => trade.trade_reference === completedOrder.id),
      'completed trade must appear in the public completed-trade ledger');
    for (const trade of publicTradePayload.data) {
      assert.equal(Object.hasOwn(trade, 'buyer_user_id'), false, 'public completed trades must not expose buyer IDs');
      assert.equal(Object.hasOwn(trade, 'seller_user_id'), false, 'public completed trades must not expose seller IDs');
      assert.equal(Object.hasOwn(trade, 'payment_reference'), false, 'public completed trades must not expose payment references');
    }

    const disputeAd = await createAd('sell', '5');
    const disputeOrderResponse = await placeOrder('buyer', disputeAd.id);
    assert.equal(disputeOrderResponse.status, 201);
    const disputeOrder = (await disputeOrderResponse.json()).order;
    const prematureDispute = await call('buyer', 'POST', '/api/p2p/orders/' + disputeOrder.id + '/dispute', { reason: 'Payment not received' });
    assert.equal(prematureDispute.status, 409, 'dispute must not open before buyer marks payment sent');
    const disputePaymentSent = await call('buyer', 'POST', '/api/p2p/orders/' + disputeOrder.id + '/payment-sent', {});
    assert.equal(disputePaymentSent.status, 201);
    const dispute = await call('buyer', 'POST', '/api/p2p/orders/' + disputeOrder.id + '/dispute', { reason: 'Seller has not confirmed receipt' });
    assert.equal(dispute.status, 201, 'either trade participant may open a dispute after payment-sent');
    const duplicateDispute = await call('buyer', 'POST', '/api/p2p/orders/' + disputeOrder.id + '/dispute', { reason: 'Duplicate dispute request' });
    assert.equal(duplicateDispute.status, 409, 'dispute transition must not be replayed');

    const concurrentAd = await createAd('sell', '1');
    const concurrent = await Promise.all([
      placeOrder('buyer', concurrentAd.id, '1000.00'),
      placeOrder('other', concurrentAd.id, '1000.00'),
    ]);
    const concurrentStatuses = concurrent.map((response) => response.status).sort((a, b) => a - b);
    assert.deepEqual(concurrentStatuses, [201, 409],
      'row locking must prevent two buyers from reserving the same final quantity');

    console.log('P2P two-party authorization, reservation, cancellation, payment, completion, dispute and concurrency tests passed.');
  } finally {
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('P2P lifecycle integration test failed:', error);
  process.exitCode = 1;
});
