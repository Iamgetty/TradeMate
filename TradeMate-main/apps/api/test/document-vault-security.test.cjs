const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const moduleSource = readFileSync(join(root, 'src', 'module.ts'), 'utf8');
const migration = readFileSync(join(root, 'database', 'migrations', '056_platform_document_vault.sql'), 'utf8');
const manifest = readFileSync(join(root, 'scripts', 'migrate.js'), 'utf8');

test('document vault migration is registered after the Persona event read grant', () => {
  const grant = manifest.indexOf("'055_persona_webhook_event_read_grant.sql'");
  const vault = manifest.indexOf("'056_platform_document_vault.sql'");
  assert.notEqual(grant, -1);
  assert.notEqual(vault, -1);
  assert.ok(grant < vault);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_documents/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_document_access/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.user_documents FROM PUBLIC/);
  assert.match(migration, /GRANT SELECT, INSERT ON TABLE public\.user_documents TO trademate_app/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.user_document_access TO trademate_app/);
});

test('public document upload cannot manufacture signed or trusted workflow records', () => {
  const controllerStart = moduleSource.indexOf("@Controller('documents')");
  assert.notEqual(controllerStart, -1);
  const controllerEnd = moduleSource.indexOf("@Controller(", controllerStart + 1);
  const controller = moduleSource.slice(controllerStart, controllerEnd === -1 ? undefined : controllerEnd);
  assert.match(controller, /\['contract','contract_negotiation','user_upload'\]/);
  assert.match(controller, /\['draft','received'\]/);
  assert.doesNotMatch(controller, /document_status\s*:\s*['"]signed['"]/);
  assert.match(controller, /hasMatchingUploadSignature/);
});

test('organization verification vault access requires current owner or admin membership', () => {
  assert.match(moduleSource, /d\.source_type <> 'organization_verification' OR om\.member_role IN \('owner','admin'\)/);
  assert.match(moduleSource, /Only organization owners and admins can view verification documents/);
});

test('contract document visibility is restricted to actual contract participants', () => {
  assert.match(moduleSource, /Contract documents must be private or shared only with the contract participants/);
  assert.match(moduleSource, /c\.buyer_user_id = \$[12]/);
  assert.match(moduleSource, /c\.seller_organization_id AND om\.user_id = \$[12]/);
});

test('vault downloads are authenticated and audited', () => {
  assert.match(moduleSource, /@Get\(':id\/download'\)/);
  assert.match(moduleSource, /accessibleDocument\(id, userId, true\)/);
  assert.match(moduleSource, /document\.downloaded/);
});

test('Portfolio all-documents panel waits for the live vault list before rendering', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  assert.match(portfolioSource, /pmLoadDocs\(\)\.then\(pmAllDocs\)/);
});
test('new contract proposals generate a private participant-visible vault PDF without claiming signature', () => {
  assert.match(moduleSource, /const buildContractRecordPdf =/);
  assert.match(moduleSource, /TRADEMATE CONTRACT RECORD/);
  assert.match(moduleSource, /It is not a signed agreement, digital signature, or proof of acceptance/);
  assert.match(moduleSource, /const contractPdf = buildContractRecordPdf\(created\.rows\[0\], 'proposal'\)/);
  assert.match(moduleSource, /'contract_participants'/);
  assert.match(moduleSource, /INSERT INTO user_documents \(owner_user_id, source_type, source_id, document_type, document_status, visibility/);
  assert.match(moduleSource, /signature_status: 'not_signed'/);
  assert.match(moduleSource, /TradeMate-Contract-Proposal-/);
  assert.match(moduleSource, /const saveContractVaultRecord =/);
  assert.match(moduleSource, /saveContractVaultRecord\(client, \{ \.\.\.contractRecord\.rows\[0\], status \}, status, current\.rows\[0\]\.buyer_user_id\)/);
  assert.match(moduleSource, /saveContractVaultRecord\(client, \{ \.\.\.contractRecord\.rows\[0\], status: 'cancelled' \}, 'cancelled', current\.rows\[0\]\.buyer_user_id\)/);
  assert.match(moduleSource, /completed \? 'completed' : 'fulfilment-confirmed'/);
  assert.match(moduleSource, /signature_status: 'not_signed'/);
});

test('email verification generates a private vault PDF limited to email-address verification', () => {
  assert.match(moduleSource, /const buildEmailVerificationRecordPdf =/);
  assert.match(moduleSource, /TRADEMATE EMAIL VERIFICATION RECORD/);
  assert.match(moduleSource, /completed TradeMate email verification/);
  assert.match(moduleSource, /does not verify the account holder identity/);
  assert.ok(moduleSource.includes("\\'email_verification\\', NULL, \\'other\\', \\'generated\\', \\'private\\'"));
  assert.match(moduleSource, /record_type: 'email_verification_event'/);
  assert.match(moduleSource, /verification_scope: 'email_address_only'/);
  const confirmStart = moduleSource.indexOf('async confirmEmailVerification');
  const confirmEnd = moduleSource.indexOf("@Post('login')", confirmStart);
  const confirmHandler = moduleSource.slice(confirmStart, confirmEnd);
  assert.match(confirmHandler, /client\.query\('BEGIN'\)/);
  assert.match(confirmHandler, /client\.query\('COMMIT'\)/);
  assert.match(confirmHandler, /client\.query\('ROLLBACK'\)/);
  assert.match(confirmHandler, /client\.release\(\)/);
});

test('new account registration generates a private vault record in the same transaction', () => {
  assert.match(moduleSource, /const buildAccountRegistrationRecordPdf =/);
  assert.match(moduleSource, /TRADEMATE ACCOUNT REGISTRATION RECORD/);
  assert.match(moduleSource, /Email ownership had not yet been confirmed/);
  assert.match(moduleSource, /const registered = await client\.query\([\s\S]*register_password_account[\s\S]*AS user_id/);
  assert.match(moduleSource, /buildAccountRegistrationRecordPdf\(\{[\s\S]*status: 'pending email verification'/);
  assert.ok(moduleSource.includes("VALUES ($1, \\'account\\', $1, \\'other\\', \\'generated\\', \\'private\\', $2"));
  assert.match(moduleSource, /record_type: 'account_registration_event'/);
  assert.match(moduleSource, /email_verification_completed: false/);
});

test('organization creation generates an honest registration-event PDF in the organization vault', () => {
  assert.match(moduleSource, /const buildOrganizationRegistrationPdf =/);
  assert.match(moduleSource, /TRADEMATE ORGANIZATION REGISTRATION RECORD/);
  assert.match(moduleSource, /not a certificate of incorporation/);
  assert.match(moduleSource, /'organization_registration'/);
  assert.match(moduleSource, /'organization','generated','organization'/);
  assert.match(moduleSource, /organization_registration_event/);
  assert.match(moduleSource, /legal_registration_certificate: false/);
});
