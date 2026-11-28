const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const pdf = Buffer.from('%PDF-1.4\nTradeMate vault integration fixture\n', 'ascii');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for document-vault integration tests.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === 'require' ? true : undefined, max: 3 });
  let app;
  try {
    const suffix = randomUUID();
    const actors = {};
    for (const role of ['owner', 'admin', 'member', 'outsider', 'stranger']) {
      const user = await pool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1,$2,'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Vault test ' + role],
      );
      const token = 'vault-' + role + '-' + suffix;
      await pool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now() + interval '10 minutes')",
        [user.rows[0].id, tokenHash(token)],
      );
      actors[role] = { id: user.rows[0].id, token };
    }
    const org = await pool.query(
      "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1,'business','NG','NGN','active') RETURNING id",
      ['Vault test organization ' + suffix],
    );
    const organizationId = org.rows[0].id;
    const listing = await pool.query(
      "INSERT INTO listings (seller_organization_id,title,description,listing_type,price_minor_units,currency_code,country_code,status) VALUES ($1,$2,'Vault contract integration fixture','service',10000,'NGN','NG','published') RETURNING id",
      [organizationId, 'Vault contract offer ' + suffix],
    );
    for (const role of ['owner', 'admin', 'member']) {
      await pool.query(
        'INSERT INTO organization_members (organization_id,user_id,member_role) VALUES ($1,$2,$3)',
        [organizationId, actors[role].id, role],
      );
    }

    const insertDocument = async ({ owner, sourceType = 'user_upload', visibility = 'private', organization = null, name }) => {
      const result = await pool.query(
        `INSERT INTO user_documents
          (owner_user_id,organization_id,source_type,document_type,document_status,visibility,file_name,mime_type,file_size,file_sha256,file_data,metadata)
         VALUES ($1,$2,$3,'other','received',$4,$5,'application/pdf',$6,$7,$8,'{}'::jsonb)
         RETURNING id`,
        [owner, organization, sourceType, visibility, name, pdf.length, createHash('sha256').update(pdf).digest('hex'), pdf],
      );
      return result.rows[0].id;
    };
    const privateId = await insertDocument({ owner: actors.owner.id, name: 'private-owner.pdf' });
    const verificationId = await insertDocument({
      owner: actors.owner.id, sourceType: 'organization_verification', visibility: 'organization',
      organization: organizationId, name: 'verification-owner.pdf',
    });

    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    app.use(json({ limit: '28mb' }));
    app.use(databaseRequestContextMiddleware);
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const baseUrl = 'http://127.0.0.1:' + app.getHttpServer().address().port;
    const request = (role, path) => fetch(baseUrl + '/api/documents' + path, {
      headers: { cookie: 'trademate_session=' + encodeURIComponent(actors[role].token) },
    });
    const call = (role, method, path, body) => fetch(baseUrl + path, {
      method,
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors[role].token),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const proposal = await call('outsider', 'POST', '/api/market/contracts', {
      listingId: listing.rows[0].id,
      amount: '100.00',
      scope: 'Document vault contract evidence test.',
      terms: 'Test-only contract terms.',
    });
    assert.equal(proposal.status, 201, 'buyer must be able to create the contract fixture');
    const contractId = (await proposal.json()).data.id;
    const contractPdf = Buffer.from('%PDF-1.4\\nContract participant document\\n', 'ascii');
    const contractUpload = await call('outsider', 'POST', '/api/documents', {
      fileName: 'contract-participants.pdf',
      mimeType: 'application/pdf',
      dataBase64: contractPdf.toString('base64'),
      sourceType: 'contract',
      sourceId: contractId,
      documentType: 'contract',
      visibility: 'contract_participants',
    });
    assert.equal(contractUpload.status, 201, 'contract buyer must upload a participant-visible document');
    const contractDocumentId = (await contractUpload.json()).document.id;
    assert.equal((await request('owner', '/' + contractDocumentId)).status, 200,
      'seller organization owner must access contract participant documents');
    assert.equal((await request('member', '/' + contractDocumentId)).status, 200,
      'seller organization member must access contract participant documents');
    assert.equal((await request('admin', '/' + contractDocumentId)).status, 200,
      'seller organization admin must access contract participant documents');
    assert.equal((await request('admin', '/' + contractDocumentId + '/download')).status, 200,
      'seller participant must download contract participant document');
    assert.equal((await request('stranger', '/' + contractDocumentId)).status, 404,
      'a user outside both contract parties must not read the document');
    const outsiderContractList = await request('owner', '');
    assert.ok((await outsiderContractList.json()).documents.some((document) => document.id === contractDocumentId),
      'contract participants must see the contract document in list results');

    const ownerGet = await request('owner', '/' + privateId);
    assert.equal(ownerGet.status, 200, 'document owner must read private metadata');
    const ownerBody = await ownerGet.json();
    assert.equal(ownerBody.document.id, privateId);
    assert.equal(ownerBody.document.file_data, undefined, 'metadata response must not expose file bytes');

    const ownerDownload = await request('owner', '/' + privateId + '/download');
    assert.equal(ownerDownload.status, 200, 'owner must download private document');
    assert.equal(Buffer.from(await ownerDownload.arrayBuffer()).toString('ascii'), pdf.toString('ascii'));
    assert.equal(ownerDownload.headers.get('cache-control'), 'private, no-store');

    const ownerPreview = await request('owner', '/' + privateId + '/preview');
    assert.equal(ownerPreview.status, 200, 'owner must preview private document');
    assert.equal(ownerPreview.headers.get('x-content-type-options'), 'nosniff');

    for (const suffixPath of ['/' + privateId, '/' + privateId + '/download', '/' + privateId + '/preview']) {
      const denied = await request('outsider', suffixPath);
      assert.equal(denied.status, 404, 'unshared outsider must not discover or retrieve a private document: ' + suffixPath);
    }
    const outsiderListBefore = await request('outsider', '');
    assert.equal(outsiderListBefore.status, 200);
    assert.ok(!(await outsiderListBefore.json()).documents.some((document) => document.id === privateId),
      'unshared outsider must not see the private document in list results');

    await pool.query(
      "INSERT INTO user_document_access (document_id,user_id,granted_by_user_id,access_reason) VALUES ($1,$2,$3,'explicit_share')",
      [privateId, actors.outsider.id, actors.owner.id],
    );
    for (const suffixPath of ['/' + privateId, '/' + privateId + '/download', '/' + privateId + '/preview']) {
      const shared = await request('outsider', suffixPath);
      assert.equal(shared.status, 200, 'explicitly shared user must access the document: ' + suffixPath);
      if (suffixPath.endsWith('/download') || suffixPath.endsWith('/preview')) await shared.arrayBuffer();
      else await shared.json();
    }
    const outsiderListAfterShare = await request('outsider', '');
    assert.ok((await outsiderListAfterShare.json()).documents.some((document) => document.id === privateId),
      'explicitly shared user must see the document in list results');

    await pool.query('DELETE FROM user_document_access WHERE document_id = $1 AND user_id = $2', [privateId, actors.outsider.id]);
    const revoked = await request('outsider', '/' + privateId);
    assert.equal(revoked.status, 404, 'revoked explicit share must immediately remove access');

    const memberVerification = await request('member', '/' + verificationId);
    assert.equal(memberVerification.status, 404, 'ordinary organization member must not read verification document metadata');
    const adminVerification = await request('admin', '/' + verificationId);
    assert.equal(adminVerification.status, 200, 'organization admin must read verification document metadata');
    await pool.query(
      "INSERT INTO user_document_access (document_id,user_id,granted_by_user_id,access_reason) VALUES ($1,$2,$3,'explicit_share')",
      [verificationId, actors.member.id, actors.owner.id],
    );
    const memberAfterExplicitShare = await request('member', '/' + verificationId);
    assert.equal(memberAfterExplicitShare.status, 404,
      'explicit share must not bypass organization verification owner/admin restriction');
    const memberList = await request('member', '');
    assert.ok(!(await memberList.json()).documents.some((document) => document.id === verificationId),
      'ordinary member must not see organization verification documents in list results');

    console.log('Document vault PostgreSQL-backed owner, explicit-share, revocation, organization-role, metadata, preview and download tests passed.');
  } finally {
    if (app) await app.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Document vault integration test failed:', error);
  process.exitCode = 1;
});
