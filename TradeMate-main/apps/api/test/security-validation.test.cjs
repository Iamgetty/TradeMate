const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEnvironment } = require('../dist/environment');

const {
  registerBodySchema,
  loginBodySchema,
  changePasswordBodySchema,
  passwordResetRequestBodySchema,
  emailVerificationBodySchema,
  passwordResetCompleteBodySchema,
  totpCodeBodySchema,
  totpChallengeBodySchema,
  deletionCancelBodySchema,
  preferencesBodySchema,
  publicProfileBodySchema,
  feedPostBodySchema,
  supportTicketBodySchema,
  organizationDocumentManagerRoleSchema,
  organizationDocumentsBodySchema,
  listingBodySchema,
  enquiryCreateBodySchema,
  contractCreateBodySchema,
  p2pAdBodySchema,
  p2pOrderBodySchema,
  feedReportBodySchema,
  reviewDecisionBodySchema,
  marketplaceBrowseQuerySchema,
  marketActivityQuerySchema,
  marketCompletedQuerySchema,
  p2pMarketQuerySchema,
  feedPostsQuerySchema,
  marketQuotesQuerySchema,
} = require('../dist/validation');

test('registration accepts normalized valid account data', () => {
  const result = registerBodySchema.safeParse({
    email: '  trader@example.com ',
    password: 'correct horse battery staple',
    displayName: '  Trader One ',
  });
  assert.equal(result.success, true);
  assert.equal(result.data.email, 'trader@example.com');
  assert.equal(result.data.displayName, 'Trader One');
});

test('registration rejects short passwords, invalid email and unexpected keys', () => {
  assert.equal(registerBodySchema.safeParse({
    email: 'not-an-email', password: 'short', displayName: 'Trader',
  }).success, false);
  assert.equal(registerBodySchema.safeParse({
    email: 'trader@example.com', password: 'correct horse battery staple',
    displayName: 'Trader', isAdmin: true,
  }).success, false);
});

test('login rejects malformed and overlong credentials', () => {
  assert.equal(loginBodySchema.safeParse({ email: 'bad', password: 'secret' }).success, false);
  assert.equal(loginBodySchema.safeParse({ email: 'trader@example.com', password: 'x'.repeat(129) }).success, false);
});

test('email verification requires a normalized email and exactly six numeric digits', () => {
  assert.equal(emailVerificationBodySchema.safeParse({ email: ' Trader@Example.com ', code: '012345' }).success, true);
  assert.equal(emailVerificationBodySchema.safeParse({ email: 'trader@example.com', code: '12345' }).success, false);
  assert.equal(emailVerificationBodySchema.safeParse({ email: 'trader@example.com', code: '12a456' }).success, false);
  assert.equal(emailVerificationBodySchema.safeParse({ email: 'trader@example.com', code: '123456', userId: 'attacker' }).success, false);
});

test('password reset requests normalize email and reject unexpected fields', () => {
  assert.equal(passwordResetRequestBodySchema.safeParse({ email: ' Trader@Example.com ' }).success, true);
  assert.equal(passwordResetRequestBodySchema.safeParse({ email: 'not-an-email' }).success, false);
  assert.equal(passwordResetRequestBodySchema.safeParse({ email: 'trader@example.com', userId: 'attacker' }).success, false);
});

test('password reset completion requires a bounded opaque token and strong password', () => {
  assert.equal(passwordResetCompleteBodySchema.safeParse({ token: 'A'.repeat(43), newPassword: 'a sufficiently long password' }).success, true);
  assert.equal(passwordResetCompleteBodySchema.safeParse({ token: 'short', newPassword: 'a sufficiently long password' }).success, false);
  assert.equal(passwordResetCompleteBodySchema.safeParse({ token: 'A'.repeat(43), newPassword: 'short' }).success, false);
  assert.equal(passwordResetCompleteBodySchema.safeParse({ token: 'A'.repeat(43), newPassword: 'a sufficiently long password', admin: true }).success, false);
});

test('password change requires a different strong password', () => {
  assert.equal(changePasswordBodySchema.safeParse({
    currentPassword: 'same password long', newPassword: 'same password long',
  }).success, false);
  assert.equal(changePasswordBodySchema.safeParse({
    currentPassword: 'old password long', newPassword: 'new password long',
  }).success, true);
});

test('TOTP schemas require six digits and a bounded challenge token', () => {
  assert.equal(totpCodeBodySchema.safeParse({ code: '12345' }).success, false);
  assert.equal(totpCodeBodySchema.safeParse({ code: '123456' }).success, true);
  assert.equal(totpChallengeBodySchema.safeParse({
    challengeToken: 'x'.repeat(43), code: '123456',
  }).success, true);
});

test('account deletion cancellation requires a valid one-time token format', () => {
  assert.equal(deletionCancelBodySchema.safeParse({ token: 'short' }).success, false);
  assert.equal(deletionCancelBodySchema.safeParse({ token: 'A'.repeat(43) }).success, true);
});

test('preferences reject unsupported keys and invalid value types', () => {
  assert.equal(preferencesBodySchema.safeParse({ orders: true }).success, true);
  assert.equal(preferencesBodySchema.safeParse({ orders: 'yes' }).success, false);
  assert.equal(preferencesBodySchema.safeParse({ isAdmin: true }).success, false);
});

test('public profile validates field lengths, social handles and image formats', () => {
  assert.equal(publicProfileBodySchema.safeParse({ bio: 'A useful profile', instagramUsername: 'trader_1' }).success, true);
  assert.equal(publicProfileBodySchema.safeParse({ instagramUsername: 'not a handle' }).success, false);
  assert.equal(publicProfileBodySchema.safeParse({ profilePhotoData: 'javascript:alert(1)' }).success, false);
});

test('feed posts allow optional titles while enforcing content and attachment limits', () => {
  const valid = { type: 'post', title: 'Trade update', body: 'A useful update', attachments: [] };
  assert.equal(feedPostBodySchema.safeParse(valid).success, true);
  assert.equal(feedPostBodySchema.safeParse({ type: 'post', body: 'A useful update' }).success, true);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, title: '' }).success, true);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, title: 'x'.repeat(141) }).success, false);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, body: '' }).success, false);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, attachments: Array(5).fill({ name: 'a', type: 'image/jpeg', data: 'YQ==' }) }).success, false);
});

test('support tickets enforce allowed categories and bounded content', () => {
  assert.equal(supportTicketBodySchema.safeParse({
    category: 'Orders', subject: 'Order issue', message: 'Please help me with this order.',
  }).success, true);
  assert.equal(supportTicketBodySchema.safeParse({
    category: 'Other category', subject: 'x', message: 'short',
  }).success, false);
});

test('only organization owners and admins may manage verification documents', () => {
  assert.equal(organizationDocumentManagerRoleSchema.safeParse('owner').success, true);
  assert.equal(organizationDocumentManagerRoleSchema.safeParse('admin').success, true);
  assert.equal(organizationDocumentManagerRoleSchema.safeParse('member').success, false);
  assert.equal(organizationDocumentManagerRoleSchema.safeParse('OWNER').success, false);
});

test('organization document uploads enforce count, MIME and encoded size', () => {
  const file = { fileName: 'certificate.pdf', mimeType: 'application/pdf', dataBase64: 'YQ==' };
  assert.equal(organizationDocumentsBodySchema.safeParse({ files: [file] }).success, true);
  assert.equal(organizationDocumentsBodySchema.safeParse({ files: [{ ...file, mimeType: 'text/html' }] }).success, false);
  assert.equal(organizationDocumentsBodySchema.safeParse({ files: Array(5).fill(file) }).success, false);
});

test('listing prices and quantities are validated without floating point coercion', () => {
  const valid = { title: 'Bulk rice supply', description: 'Wholesale offer', listingType: 'b2b', price: '10.25', quantityAvailable: '12' };
  assert.equal(listingBodySchema.safeParse(valid).success, true);
  assert.equal(listingBodySchema.safeParse({ ...valid, price: '10.256' }).success, false);
  assert.equal(listingBodySchema.safeParse({ ...valid, quantityAvailable: '1.5' }).success, false);
});

test('enquiries and contracts require valid UUIDs and date formats', () => {
  const listingId = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(enquiryCreateBodySchema.safeParse({ listingId, message: 'Please send more information.' }).success, true);
  assert.equal(enquiryCreateBodySchema.safeParse({ listingId: 'not-a-uuid', message: 'Please send more information.' }).success, false);
  assert.equal(contractCreateBodySchema.safeParse({
    listingId, amount: '1200.50', scope: 'Deliver the agreed service', terms: 'Payment after acceptance',
    startDate: '2026-11-02', completionDate: '2026-11-30',
  }).success, true);
  assert.equal(contractCreateBodySchema.safeParse({
    listingId, amount: '1200.50', scope: 'Deliver the agreed service', terms: 'Payment after acceptance',
    startDate: '2026-02-31',
  }).success, false);
});

test('P2P ad and order schemas reject invalid asset, currency and amounts', () => {
  const ad = { side: 'sell', asset: 'USDT', fiat: 'NGN', price: 1500, quantity: 10, paymentMethods: ['Bank transfer'] };
  assert.equal(p2pAdBodySchema.safeParse(ad).success, true);
  assert.equal(p2pAdBodySchema.safeParse({ ...ad, fiat: 'N' }).success, false);
  assert.equal(p2pOrderBodySchema.safeParse({ adId: '123e4567-e89b-42d3-a456-426614174000', fiatAmount: 15000 }).success, true);
});

test('reports require exactly one target and review actions are allow-listed', () => {
  const postId = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(feedReportBodySchema.safeParse({ postId, reason: 'This post is fraudulent.' }).success, true);
  assert.equal(feedReportBodySchema.safeParse({ postId, commentId: postId, reason: 'This post is fraudulent.' }).success, false);
  assert.equal(reviewDecisionBodySchema.safeParse({ decision: 'approved', note: 'Verified' }).success, true);
  assert.equal(reviewDecisionBodySchema.safeParse({ decision: 'delete' }).success, false);
});

test('marketplace and market-data query schemas enforce supported filters and pagination', () => {
  assert.equal(marketplaceBrowseQuerySchema.safeParse({ search: 'rice', country: 'NG', type: 'b2b', page: '1', limit: '20' }).success, true);
  assert.equal(marketplaceBrowseQuerySchema.safeParse({ page: '-1', limit: '999' }).success, false);
  assert.equal(marketActivityQuerySchema.safeParse({ view: 'book', market: 'p2p', limit: '100' }).success, true);
  assert.equal(marketActivityQuerySchema.safeParse({ view: 'book', market: 'P2P', limit: '100' }).success, true);
  assert.equal(marketActivityQuerySchema.safeParse({ view: 'admin', limit: '100' }).success, false);
  assert.equal(marketCompletedQuerySchema.safeParse({ type: 'service', currency: 'NGN', limit: '50' }).success, true);
});

test('P2P, feed and market quote queries reject unsupported values', () => {
  assert.equal(p2pMarketQuerySchema.safeParse({ asset: 'USDT', fiat: 'NGN', side: 'buy', limit: '50' }).success, true);
  assert.equal(p2pMarketQuerySchema.safeParse({ asset: 'USDT', fiat: 'NGN', side: 'BUY', limit: '50' }).success, true);
  assert.equal(p2pMarketQuerySchema.safeParse({ asset: 'USDT', fiat: 'NGN', side: 'short' }).success, false);
  assert.equal(feedPostsQuerySchema.safeParse({ type: 'Announcements', limit: '30' }).success, true);
  assert.equal(feedPostsQuerySchema.safeParse({ limit: '1000' }).success, false);
  assert.equal(marketQuotesQuerySchema.safeParse({ symbols: 'AAPL,MSFT' }).success, true);
  assert.equal(marketQuotesQuerySchema.safeParse({ symbols: '' }).success, false);
});

test('production environment validation requires PostgreSQL and a 256-bit TOTP key', () => {
  const valid = validateEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://trade_user:placeholder@localhost:5432/trademate',
    TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
    WEB_ORIGIN: 'https://trademate-web.onrender.com',
  });
  assert.equal(valid.NODE_ENV, 'production');
  assert.throws(() => validateEnvironment({
    NODE_ENV: 'production',
    TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
  }), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://trade_user:placeholder@localhost:5432/trademate',
  }), /TOTP_ENCRYPTION_KEY/);
});

test('environment validation rejects malformed URLs, origins and key formats', () => {
  assert.throws(() => validateEnvironment({
    NODE_ENV: 'production', DATABASE_URL: 'https://example.com',
    TOTP_ENCRYPTION_KEY: 'a'.repeat(64),
  }), /DATABASE_URL/);
  assert.throws(() => validateEnvironment({
    NODE_ENV: 'development', WEB_ORIGIN: 'javascript:alert(1)',
  }), /WEB_ORIGIN/);
  assert.throws(() => validateEnvironment({
    NODE_ENV: 'development', TOTP_ENCRYPTION_KEY: 'not-a-key',
  }), /TOTP_ENCRYPTION_KEY/);
});

test('P2P decimal inputs enforce database precision and fiat scale', () => {
  const ad = { side: 'sell', asset: 'BTC', fiat: 'USD', price: '65000.1234567890', quantity: '0.000000010001', minFiatAmount: '0.01', maxFiatAmount: '0.65' };
  assert.equal(p2pAdBodySchema.safeParse(ad).success, true);
  assert.equal(p2pAdBodySchema.safeParse({ ...ad, price: '1.12345678901' }).success, false);
  assert.equal(p2pAdBodySchema.safeParse({ ...ad, quantity: '0.0000000000001' }).success, false);
  assert.equal(p2pAdBodySchema.safeParse({ ...ad, maxFiatAmount: '1.001' }).success, false);
  assert.equal(p2pOrderBodySchema.safeParse({ adId: '123e4567-e89b-42d3-a456-426614174000', fiatAmount: '12.34' }).success, true);
  assert.equal(p2pOrderBodySchema.safeParse({ adId: '123e4567-e89b-42d3-a456-426614174000', fiatAmount: '12.345' }).success, false);
});
