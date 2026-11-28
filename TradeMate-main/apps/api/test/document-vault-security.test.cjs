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
