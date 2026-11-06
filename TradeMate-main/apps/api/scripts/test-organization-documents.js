const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const { NestFactory } = require('@nestjs/core');
const { json } = require('express');
const { AppModule } = require('../dist/module');
const { databaseRequestContextMiddleware } = require('../dist/database-context');

const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for organization document integration tests.');

  const rawPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
    max: 2,
  });
  let app;
  let triggerInstalled = false;

  try {
    const suffix = randomUUID();
    const organization = await rawPool.query(
      "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, 'business', 'NG', 'NGN', 'active') RETURNING id",
      ['Document integration ' + suffix],
    );
    const organizationId = organization.rows[0].id;
    const actors = {};

    for (const role of ['owner', 'admin', 'member']) {
      const user = await rawPool.query(
        "INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id",
        [role + '-' + suffix + '@example.invalid', 'Document test ' + role],
      );
      const userId = user.rows[0].id;
      const token = 'document-test-' + role + '-' + suffix;
      await rawPool.query(
        'INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval \'10 minutes\')',
        [userId, tokenHash(token)],
      );
      await rawPool.query(
        'INSERT INTO organization_members (organization_id, user_id, member_role) VALUES ($1, $2, $3)',
        [organizationId, userId, role],
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
    const request = (role, method, body) => fetch(baseUrl + '/api/organizations/' + organizationId + '/documents', {
      method,
      headers: {
        cookie: 'trademate_session=' + encodeURIComponent(actors[role].token),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const file = (name) => ({
      files: [{ fileName: name, mimeType: 'application/pdf', dataBase64: 'YQ==' }],
    });

    for (const role of ['owner', 'admin']) {
      const response = await request(role, 'GET');
      assert.equal(response.status, 200, role + ' must be allowed to list organization documents');
    }
    const memberList = await request('member', 'GET');
    assert.equal(memberList.status, 403, 'ordinary members must not list verification documents');

    const ownerUpload = await request('owner', 'POST', file('owner.pdf'));
    assert.equal(ownerUpload.status, 201, 'owner upload must succeed');
    const adminUpload = await request('admin', 'POST', file('admin.pdf'));
    assert.equal(adminUpload.status, 201, 'admin upload must succeed');
    const memberUpload = await request('member', 'POST', file('member.pdf'));
    assert.equal(memberUpload.status, 403, 'ordinary member upload must be forbidden');

    const beforeFailure = await rawPool.query(
      'SELECT count(*)::int AS count FROM organization_documents WHERE organization_id = $1',
      [organizationId],
    );

    await rawPool.query(`
      CREATE OR REPLACE FUNCTION test_reject_organization_document_audit() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'organization.documents_uploaded' THEN
          RAISE EXCEPTION 'forced audit insert failure for rollback test';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await rawPool.query(`
      CREATE TRIGGER test_reject_organization_document_audit_trigger
      BEFORE INSERT ON audit_events
      FOR EACH ROW EXECUTE FUNCTION test_reject_organization_document_audit();
    `);
    triggerInstalled = true;

    const failedUpload = await request('owner', 'POST', file('must-rollback.pdf'));
    assert.equal(failedUpload.status, 500, 'forced audit failure must fail the upload request');

    const afterFailure = await rawPool.query(
      'SELECT count(*)::int AS count FROM organization_documents WHERE organization_id = $1',
      [organizationId],
    );
    assert.equal(afterFailure.rows[0].count, beforeFailure.rows[0].count,
      'document rows must roll back when the audit insert fails');

    console.log('Organization document HTTP authorization and transaction rollback integration tests passed.');
  } finally {
    if (triggerInstalled) {
      await rawPool.query('DROP TRIGGER IF EXISTS test_reject_organization_document_audit_trigger ON audit_events').catch(() => undefined);
      await rawPool.query('DROP FUNCTION IF EXISTS test_reject_organization_document_audit()').catch(() => undefined);
    }
    if (app) await app.close();
    await rawPool.end();
  }
}

main().catch((error) => {
  console.error('Organization document integration test failed:', error);
  process.exitCode = 1;
});
