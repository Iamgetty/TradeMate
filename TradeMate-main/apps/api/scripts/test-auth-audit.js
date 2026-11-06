const assert = require('node:assert/strict');
const { randomUUID, createHash, createHmac } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const digest = (value) => createHash('sha256').update(value).digest('hex');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(value) {
  let bits = '';
  for (const char of value.replace(/=+$/g, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('Invalid base32 TOTP secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret, timestamp = Date.now()) {
  const counter = BigInt(Math.floor(timestamp / 30000));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const hmac = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary = ((hmac[offset] & 127) << 24) | ((hmac[offset + 1] & 255) << 16) |
    ((hmac[offset + 2] & 255) << 8) | (hmac[offset + 3] & 255);
  return String(binary % 1000000).padStart(6, '0');
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for auth audit integration tests.');
  if (!process.env.TOTP_ENCRYPTION_KEY) process.env.TOTP_ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.TRADEMATE_REVIEW_API_KEY = 'test-review-key-' + randomUUID();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? true : undefined, max: 3 });
  let app;
  let triggerInstalled = false;
  try {
    const suffix = randomUUID();
    const user = await pool.query(
      "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
      ['auth-audit-' + suffix + '@example.invalid', 'Auth audit test'],
    );
    const userId = user.rows[0].id;
    const target = await pool.query("INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id", ['auth-audit-target-' + suffix + '@example.invalid', 'Follow target']);
    const targetId = target.rows[0].id;
    const currentToken = 'auth-audit-current-' + suffix;
    const otherToken = 'auth-audit-other-' + suffix;
    const currentSession = await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\') RETURNING id',
      [userId, digest(currentToken)],
    );
    const otherSession = await pool.query(
      'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\') RETURNING id',
      [userId, digest(otherToken)],
    );

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '1mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const base = 'http://127.0.0.1:' + app.getHttpServer().address().port;
    const call = (method, path, body, extraHeaders = {}) => fetch(base + path, {
      method,
      headers: { cookie: 'trademate_session=' + encodeURIComponent(currentToken),
        ...(body ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const installReject = async (event) => {
      await pool.query(`
        CREATE OR REPLACE FUNCTION test_reject_auth_audit() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.event_type = '${event}' THEN RAISE EXCEPTION 'forced auth audit failure'; END IF;
          RETURN NEW;
        END;
        $$;
      `);
      await pool.query('DROP TRIGGER IF EXISTS test_reject_auth_audit_trigger ON audit_events');
      await pool.query('CREATE TRIGGER test_reject_auth_audit_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_auth_audit()');
      triggerInstalled = true;
    };
    const removeReject = async () => {
      await pool.query('DROP TRIGGER IF EXISTS test_reject_auth_audit_trigger ON audit_events');
      await pool.query('DROP FUNCTION IF EXISTS test_reject_auth_audit()');
      triggerInstalled = false;
    };

    await installReject('feedback.submitted');
    const feedbackFailed = await call('POST', '/api/support/feedback', { type: 'Idea', message: 'Audit rollback test feedback' });
    assert.equal(feedbackFailed.status, 500, 'audit failure must fail feedback submission');
    let feedback = await pool.query('SELECT id FROM user_feedback WHERE user_id = $1', [userId]);
    assert.equal(feedback.rowCount, 0, 'feedback insert must roll back when audit insert fails');
    await removeReject();
    const feedbackOk = await call('POST', '/api/support/feedback', { type: 'Idea', message: 'Audit success test feedback' });
    assert.equal(feedbackOk.status, 201, 'feedback submission must succeed when audit insert succeeds');

    await installReject('profile.public_details_updated');
    const publicProfileFailed = await call('PATCH', '/api/profiles/me', { bio: 'Must roll back' });
    assert.equal(publicProfileFailed.status, 500, 'audit failure must fail public profile update');
    let publicProfile = await pool.query('SELECT bio FROM user_profiles WHERE user_id=$1', [userId]);
    assert.equal(publicProfile.rowCount, 0, 'public profile insert must roll back when audit insert fails');
    await removeReject();
    const publicProfileOk = await call('PATCH', '/api/profiles/me', { bio: 'Audit success profile' });
    assert.equal(publicProfileOk.status, 200, 'public profile update must succeed when audit insert succeeds');

    await installReject('profile.followed');
    const followFailed = await call('POST', '/api/profiles/' + targetId + '/follow');
    assert.equal(followFailed.status, 500, 'audit failure must fail follow');
    let follow = await pool.query('SELECT 1 FROM user_follows WHERE follower_user_id=$1 AND followed_user_id=$2', [userId, targetId]);
    assert.equal(follow.rowCount, 0, 'follow insert must roll back when audit insert fails');
    await removeReject();
    const followOk = await call('POST', '/api/profiles/' + targetId + '/follow');
    assert.equal(followOk.status, 201, 'follow must succeed when audit insert succeeds');

    await installReject('profile.unfollowed');
    const unfollowFailed = await call('DELETE', '/api/profiles/' + targetId + '/follow');
    assert.equal(unfollowFailed.status, 500, 'audit failure must fail unfollow');
    follow = await pool.query('SELECT 1 FROM user_follows WHERE follower_user_id=$1 AND followed_user_id=$2', [userId, targetId]);
    assert.equal(follow.rowCount, 1, 'unfollow delete must roll back when audit insert fails');
    await removeReject();
    const unfollowOk = await call('DELETE', '/api/profiles/' + targetId + '/follow');
    assert.equal(unfollowOk.status, 200, 'unfollow must succeed when audit insert succeeds');

    const post = await pool.query(
      "INSERT INTO feed_posts (author_user_id, post_type, body, pinned) VALUES ($1, 'post', 'Audit pin rollback test', false) RETURNING id",
      [userId],
    );
    await installReject('feed.post.pin_changed');
    const pinFailed = await call('PATCH', '/api/feed/posts/' + post.rows[0].id + '/pin', { pinned: true });
    assert.equal(pinFailed.status, 500, 'audit failure must fail feed pin change');
    let pin = await pool.query('SELECT pinned FROM feed_posts WHERE id=$1', [post.rows[0].id]);
    assert.equal(pin.rows[0].pinned, false, 'feed pin change must roll back when audit insert fails');
    await removeReject();
    const pinOk = await call('PATCH', '/api/feed/posts/' + post.rows[0].id + '/pin', { pinned: true });
    assert.equal(pinOk.status, 200, 'feed pin change must succeed when audit insert succeeds');

    await installReject('feed.announcement.created');
    const announcementFailed = await call('POST', '/api/feed/announcements', { body: 'Audit rollback announcement' }, { 'x-review-key': process.env.TRADEMATE_REVIEW_API_KEY });
    assert.equal(announcementFailed.status, 500, 'audit failure must fail announcement creation');
    let announcement = await pool.query("SELECT id FROM feed_posts WHERE post_type='announcement' AND body='Audit rollback announcement'");
    assert.equal(announcement.rowCount, 0, 'announcement insert must roll back when audit insert fails');
    await removeReject();
    const announcementOk = await call('POST', '/api/feed/announcements', { body: 'Audit success announcement' }, { 'x-review-key': process.env.TRADEMATE_REVIEW_API_KEY });
    assert.equal(announcementOk.status, 201, 'announcement creation must succeed when audit insert succeeds');

    await installReject('profile.display_name_updated');
    const profileFailed = await call('PATCH', '/api/auth/profile', { displayName: 'Changed Name' });
    assert.equal(profileFailed.status, 500, 'audit failure must fail display-name update');
    let profile = await pool.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    assert.equal(profile.rows[0].display_name, 'Auth audit test', 'display-name update must roll back when audit insert fails');
    await removeReject();
    const profileOk = await call('PATCH', '/api/auth/profile', { displayName: 'Changed Name' });
    assert.equal(profileOk.status, 200, 'display-name update must succeed when audit insert succeeds');

    await installReject('account.preferences_updated');
    const preferencesFailed = await call('PATCH', '/api/preferences', { cur: 'USD', news: false });
    assert.equal(preferencesFailed.status, 500, 'audit failure must fail preference update');
    let preferences = await pool.query('SELECT preferences FROM user_preferences WHERE user_id = $1', [userId]);
    assert.equal(preferences.rowCount, 0, 'preference insert must roll back when audit insert fails');
    await removeReject();
    const preferencesOk = await call('PATCH', '/api/preferences', { cur: 'USD', news: false });
    assert.equal(preferencesOk.status, 200, 'preference update must succeed when audit insert succeeds');

    const setup = await call('POST', '/api/auth/2fa/setup');
    assert.equal(setup.status, 201, 'authenticated user must be able to begin TOTP setup');
    const secret = (await setup.json()).secret;
    assert.ok(secret, 'TOTP setup must return a secret');
    await installReject('auth.totp_enabled');
    const confirmFailed = await call('POST', '/api/auth/2fa/confirm', { code: totp(secret) });
    assert.equal(confirmFailed.status, 500, 'audit failure must fail TOTP enable');
    let security = await pool.query('SELECT totp_enabled, totp_secret_encrypted FROM user_auth_security WHERE user_id = $1', [userId]);
    assert.equal(security.rows[0].totp_enabled, false, 'TOTP enable must roll back when audit insert fails');
    assert.ok(security.rows[0].totp_secret_encrypted, 'pending encrypted setup secret must remain available after rollback');
    await removeReject();
    const confirmOk = await call('POST', '/api/auth/2fa/confirm', { code: totp(secret) });
    assert.equal(confirmOk.status, 201, 'TOTP enable must succeed when audit insert succeeds');

    await installReject('auth.totp_disabled');
    const disableFailed = await call('POST', '/api/auth/2fa/disable', { code: totp(secret) });
    assert.equal(disableFailed.status, 500, 'audit failure must fail TOTP disable');
    security = await pool.query('SELECT totp_enabled, totp_secret_encrypted FROM user_auth_security WHERE user_id = $1', [userId]);
    assert.equal(security.rows[0].totp_enabled, true, 'TOTP disable must roll back when audit insert fails');
    assert.ok(security.rows[0].totp_secret_encrypted, 'encrypted TOTP secret must remain after failed disable');
    await removeReject();
    const disableOk = await call('POST', '/api/auth/2fa/disable', { code: totp(secret) });
    assert.equal(disableOk.status, 201, 'TOTP disable must succeed when audit insert succeeds');

    await installReject('auth.session_revoked');
    const revokeOther = await call('DELETE', '/api/auth/sessions/' + otherSession.rows[0].id);
    assert.equal(revokeOther.status, 500, 'audit failure must fail secondary-session revocation');
    let sessionCheck = await pool.query('SELECT id FROM user_sessions WHERE id = $1', [otherSession.rows[0].id]);
    assert.equal(sessionCheck.rowCount, 1, 'secondary session deletion must roll back when audit insert fails');
    const revokeCurrent = await call('DELETE', '/api/auth/sessions/' + currentSession.rows[0].id);
    assert.equal(revokeCurrent.status, 500, 'audit failure must fail current-session revocation');
    assert.equal(revokeCurrent.headers.get('set-cookie'), null, 'cookie must not be cleared before the revocation transaction commits');
    sessionCheck = await pool.query('SELECT id FROM user_sessions WHERE id = $1', [currentSession.rows[0].id]);
    assert.equal(sessionCheck.rowCount, 1, 'current session deletion must roll back when audit insert fails');
    await removeReject();

    console.log('Audit atomicity passed: account, profile, feedback, follow and feed changes roll back when audit writes fail.');
  } finally {
    if (triggerInstalled) {
      await pool.query('DROP TRIGGER IF EXISTS test_reject_auth_audit_trigger ON audit_events').catch(() => undefined);
      await pool.query('DROP FUNCTION IF EXISTS test_reject_auth_audit()').catch(() => undefined);
    }
    if (app) await app.close();
    await pool.end();
  }
}
main().catch((error) => { console.error('Auth audit integration test failed:', error); process.exitCode = 1; });
