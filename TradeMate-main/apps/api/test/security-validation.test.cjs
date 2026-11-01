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
