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
  const uploadStart = controller.indexOf('async upload');
  const uploadEnd = controller.indexOf("@Get(':id')", uploadStart);
  const uploadHandler = controller.slice(uploadStart, uploadEnd);
  assert.match(uploadHandler, /client\.query\('BEGIN'\)/);
  assert.match(uploadHandler, /client\.query\('COMMIT'\)/);
  assert.match(uploadHandler, /client\.query\('ROLLBACK'\)/);
  assert.match(uploadHandler, /document\.uploaded/);
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

test('document previews are authenticated, access-controlled, no-store and audited', () => {
  assert.match(moduleSource, /@Get\(':id\/preview'\)/);
  assert.match(moduleSource, /accessibleDocument\(id, userId, true\)/);
  assert.match(moduleSource, /document\.previewed/);
  assert.match(moduleSource, /This document type cannot be previewed/);
  assert.match(moduleSource, /Content-Disposition', `inline;/);
  assert.match(moduleSource, /Content-Security-Policy/);
  assert.match(moduleSource, /Cache-Control', 'private, no-store'/);
});

test('Portfolio all-documents panel waits for the live vault list before rendering', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  assert.match(portfolioSource, /pmLoadDocs\(\)\.then\(pmAllDocs\)/);
});
test('Portfolio document rows expose secure preview controls backed by the preview endpoint', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  const portfolioCss = readFileSync(join(root, '..', 'web', 'public', 'tm', 'runtime-portfolio.css'), 'utf8');
  assert.match(portfolioSource, /pm-doc-preview/);
  assert.match(portfolioSource, /\/documents\/.*\/preview/);
  assert.match(portfolioSource, /URL\.revokeObjectURL/);
  assert.match(portfolioSource, /pm-inline-preview-body/);
  assert.match(portfolioCss, /\.pm-inline-preview-body/);
});

test('Portfolio Documents supports authenticated private PDF, JPG and PNG uploads', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  const portfolioCss = readFileSync(join(root, '..', 'web', 'public', 'tm', 'runtime-portfolio.css'), 'utf8');
  assert.match(portfolioSource, /pm-upload-trigger/);
  assert.match(portfolioSource, /new FileReader\(\)/);
  assert.ok(portfolioSource.includes('api("POST","/documents"'));
  assert.match(portfolioSource, /sourceType:"user_upload"/);
  assert.match(portfolioSource, /documentStatus:"received",visibility:"private"/);
  assert.match(portfolioSource, /10\*1024\*1024/);
  assert.match(portfolioCss, /\.pm-upload-tools/);
});

test('contract conversations share negotiation attachments only with contract participants', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  const contractCss = readFileSync(join(root, '..', 'web', 'public', 'tm', 'runtime-contractf2.css'), 'utf8');
  assert.match(portfolioSource, /function loadContractDocuments/);
  assert.match(portfolioSource, /function contractDocumentsPanel/);
  assert.match(portfolioSource, /contractAttachmentPick/);
  assert.match(portfolioSource, /sourceType:"contract_negotiation"/);
  assert.match(portfolioSource, /visibility:"contract_participants"/);
  assert.match(portfolioSource, /data-act="pmdl"/);
  assert.match(contractCss, /\.ct-files/);
});

test('contract negotiation file sharing is restricted to live contract participants', () => {
  const portfolioSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  assert.match(portfolioSource, /function contractDocumentsPanel/);
  assert.match(portfolioSource, /contractAttachmentPick/);
  assert.match(portfolioSource, /sourceType:"contract_negotiation"/);
  assert.match(portfolioSource, /documentType:"negotiation"/);
  assert.match(portfolioSource, /visibility:"contract_participants"/);
  assert.match(portfolioSource, /loadContractDocuments\(contract,!0\)/);
  assert.match(moduleSource, /Only contract participants can add shared documents/);
});

test('contract conversation messages link only sender-owned participant-visible vault attachments', () => {
  const manifestSource = readFileSync(join(root, 'scripts', 'migrate.js'), 'utf8');
  const migrationSource = readFileSync(join(root, 'database', 'migrations', '059_contract_message_documents.sql'), 'utf8');
  const validationSource = readFileSync(join(root, 'src', 'validation.ts'), 'utf8');
  const webSource = readFileSync(join(root, '..', 'web', 'public', 'tm', 'app.js'), 'utf8');
  const contractController = moduleSource.slice(moduleSource.indexOf("@Controller('market/contracts')"), moduleSource.indexOf("@Controller('market/trades')"));
  assert.match(manifestSource, /'059_contract_message_documents\.sql'/);
  assert.match(migrationSource, /marketplace_contract_message_documents/);
  assert.match(migrationSource, /REFERENCES public\.marketplace_contract_messages\(id, contract_id\)/);
  assert.match(migrationSource, /REFERENCES public\.user_documents\(id\)/);
  assert.match(contractController, /attachmentDocumentIds/);
  assert.match(validationSource, /attachmentDocumentIds: z\.array\(z\.string\(\)\.uuid\(\)\)\.max\(10\)\.optional\(\)/);
  assert.match(contractController, /owner_user_id = \$2 AND source_type = 'contract_negotiation'/);
  assert.match(contractController, /source_id = \$3 AND visibility = 'contract_participants'/);
  assert.match(contractController, /Only your own files uploaded to this contract can be attached/);
  assert.match(contractController, /marketplace_contract_message_documents/);
  assert.match(contractController, /AS attachments/);
  assert.match(webSource, /attachmentDocumentIds:ids/);
  assert.match(webSource, /t\.attachments\|\|\[\]/);
  assert.match(webSource, /ct-msg-files/);
  assert.match(webSource, /contractAttachmentRemove/);
});

test('completed P2P trades generate private receipt PDFs for both parties in the same transaction', () => {
  const manifestSource = readFileSync(join(root, 'scripts', 'migrate.js'), 'utf8');
  const migrationSource = readFileSync(join(root, 'database', 'migrations', '061_p2p_trade_receipt_documents.sql'), 'utf8');
  assert.match(manifestSource, /'061_p2p_trade_receipt_documents\\.sql'/);
  assert.match(migrationSource, /PRIMARY KEY \\(p2p_trade_id, user_id\\)/);
  assert.match(migrationSource, /document_id UUID NOT NULL UNIQUE/);
  assert.match(migrationSource, /REVOKE ALL ON TABLE public\\.p2p_trade_receipt_documents FROM PUBLIC/);
  assert.match(moduleSource, /const buildP2PTradeReceiptPdf/);
  const receiptPdfBuilder = moduleSource.slice(moduleSource.indexOf('const buildP2PTradeReceiptPdf'), moduleSource.indexOf('const saveP2PTradeReceiptVaultDocuments'));
  assert.match(receiptPdfBuilder, /TRADEMATE P2P TRANSACTION RECEIPT/);
  assert.match(receiptPdfBuilder, /Transaction reference:/);
  assert.match(receiptPdfBuilder, /Buyer account:/);
  assert.match(receiptPdfBuilder, /Seller account:/);
  assert.match(receiptPdfBuilder, /Fiat total:/);
  assert.match(receiptPdfBuilder, /not proof of a bank transfer/);
  assert.match(receiptPdfBuilder, /createHash/);
  const receiptSaver = moduleSource.slice(moduleSource.indexOf('const saveP2PTradeReceiptVaultDocuments'), moduleSource.indexOf('const buildContractRecordPdf'));
  assert.match(receiptSaver, /for \\(const ownerUserId of \\[String\\(trade\\.buyer_user_id\\), String\\(trade\\.seller_user_id\\)\\])/);
  assert.match(receiptSaver, /SELECT document_id FROM p2p_trade_receipt_documents WHERE p2p_trade_id = \\$1 AND user_id = \\$2/);
  assert.match(receiptSaver, /if \\(existing\\.rowCount\\) continue/);
  assert.match(receiptSaver, /'marketplace_transaction'/);
  assert.match(receiptSaver, /'receipt','generated','private'/);
  assert.match(receiptSaver, /file_sha256, file_data, metadata/);
  assert.match(receiptSaver, /INSERT INTO p2p_trade_receipt_documents/);
  const p2pController = moduleSource.slice(moduleSource.indexOf("@Controller('p2p')"), moduleSource.indexOf("@Controller('profiles')"));
  assert.match(p2pController, /confirmReceipt/);
  assert.match(p2pController, /FOR UPDATE OF t/);
  assert.match(p2pController, /saveP2PTradeReceiptVaultDocuments\\(client, receiptTrade\\)/);
  assert.match(p2pController, /receipt_documents_created: 2/);
  const confirmHandler = p2pController.slice(p2pController.indexOf('async confirmReceipt'), p2pController.indexOf("@Post('orders/:id/cancel')"));
  assert.match(confirmHandler, /client\\.query\\('BEGIN'\\)/);
  assert.match(confirmHandler, /client\\.query\\('COMMIT'\\)/);
  assert.match(confirmHandler, /client\\.query\\('ROLLBACK'\\)/);
  assert.match(moduleSource, /'p2p_completed_trade_receipt'/);
  assert.match(moduleSource, /payment_reference_included: false/);
  assert.match(moduleSource, /TradeMate does not custody funds or provide escrow/);
});
test('signed Persona inquiry events generate one private verification evidence PDF per event', () => {
  const manifestSource = readFileSync(join(root, 'scripts', 'migrate.js'), 'utf8');
  const migrationSource = readFileSync(join(root, 'database', 'migrations', '060_persona_webhook_event_documents.sql'), 'utf8');
  assert.match(manifestSource, /'060_persona_webhook_event_documents\.sql'/);
  assert.match(migrationSource, /event_id TEXT PRIMARY KEY REFERENCES public\.persona_webhook_events\(event_id\)/);
  assert.match(migrationSource, /document_id UUID NOT NULL UNIQUE REFERENCES public\.user_documents\(id\)/);
  assert.match(moduleSource, /const buildPersonaVerificationEventPdf =/);
  assert.match(moduleSource, /TRADEMATE IDENTITY VERIFICATION EVENT RECORD/);
  assert.match(moduleSource, /source_type, source_id, document_type, document_status, visibility/);
  assert.match(moduleSource, /'identity_verification',\$1,'identity','generated','private'/);
  assert.match(moduleSource, /raw_identity_images_included: false/);
  assert.match(moduleSource, /persona\.verification_event_recorded/);
  assert.match(moduleSource, /await savePersonaVerificationEventEvidence\(inquiryId\)/);
  assert.match(moduleSource, /LEFT JOIN persona_webhook_event_documents/);
  assert.match(moduleSource, /ON CONFLICT \(event_id\) DO NOTHING/);
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
  assert.match(confirmHandler, /failed attempts; commit that counter before rejecting/);
  assert.match(confirmHandler, /if \(!verified\.rowCount\) \{[\s\S]*?await client\.query\('COMMIT'\);/);
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
