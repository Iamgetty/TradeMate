const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const moduleSource = readFileSync(join(root, 'src', 'module.ts'), 'utf8');
const migration = readFileSync(join(root, 'database', 'migrations', '057_user_agreement_acceptances.sql'), 'utf8');
const manifest = readFileSync(join(root, 'scripts', 'migrate.js'), 'utf8');
const appSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
const agreement = readFileSync(join(root, '..', '..', '..', 'docs', 'legal', 'trademate-platform-user-agreement-v1.md'), 'utf8');

test('agreement acceptance migration is registered and never pre-accepts existing users', () => {
  assert.match(manifest, /'057_user_agreement_acceptances\.sql'/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_agreement_acceptances/);
  assert.match(migration, /UNIQUE \(user_id, agreement_key, agreement_version\)/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.user_agreement_acceptances FROM PUBLIC/);
  assert.match(migration, /GRANT SELECT, INSERT ON TABLE public\.user_agreement_acceptances TO trademate_app/);
  assert.doesNotMatch(migration, /INSERT INTO user_agreement_acceptances/);
});

test('agreement is versioned, served with a content hash, and acceptance requires explicit confirmation', () => {
  assert.match(moduleSource, /PLATFORM_AGREEMENT_VERSION = '1\.0'/);
  assert.match(moduleSource, /createHash\('sha256'\)\.update\(PLATFORM_AGREEMENT_CONTENT, 'utf8'\)\.digest\('hex'\)/);
  assert.match(moduleSource, /@Get\('agreement\/status'\)/);
  assert.match(moduleSource, /@Post\('agreement\/accept'\)/);
  assert.match(moduleSource, /body\?\.accepted !== true/);
  assert.match(moduleSource, /body\?\.version !== PLATFORM_AGREEMENT_VERSION/);
  assert.match(moduleSource, /account\.platform_agreement_accepted/);
  assert.match(agreement, /10\. Your acceptance/);
  assert.match(agreement, /verification is not a guarantee/i);
});

test('password, email-verification and two-factor sign-in completion all show the agreement gate', () => {
  assert.equal(appSource.split('checkAgreementThen(K)').length - 1, 3);
  assert.match(appSource, /tm-platform-agreement-gate/);
  assert.match(appSource, /I agree and continue/);
  assert.match(appSource, /I do not agree — sign out/);
  assert.match(appSource, /\/auth\/agreement\/accept/);
});
