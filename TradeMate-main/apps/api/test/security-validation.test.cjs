const test = require('node:test');
const assert = require('node:assert/strict');

const {
  registerBodySchema,
  loginBodySchema,
  changePasswordBodySchema,
  totpCodeBodySchema,
  totpChallengeBodySchema,
  deletionCancelBodySchema,
  preferencesBodySchema,
  publicProfileBodySchema,
  feedPostBodySchema,
  supportTicketBodySchema,
  organizationDocumentsBodySchema,
  listingBodySchema,
  enquiryCreateBodySchema,
  contractCreateBodySchema,
  p2pAdBodySchema,
  p2pOrderBodySchema,
  feedReportBodySchema,
  reviewDecisionBodySchema,
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

test('feed posts enforce content and attachment count limits', () => {
  const valid = { type: 'post', title: 'Trade update', body: 'A useful update', attachments: [] };
  assert.equal(feedPostBodySchema.safeParse(valid).success, true);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, attachments: Array(5).fill({ name: 'a', type: 'image/jpeg', data: 'YQ==' }) }).success, false);
  assert.equal(feedPostBodySchema.safeParse({ ...valid, title: '' }).success, false);
});

test('support tickets enforce allowed categories and bounded content', () => {
  assert.equal(supportTicketBodySchema.safeParse({
    category: 'Orders', subject: 'Order issue', message: 'Please help me with this order.',
  }).success, true);
  assert.equal(supportTicketBodySchema.safeParse({
    category: 'Other category', subject: 'x', message: 'short',
  }).success, false);
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
