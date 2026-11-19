const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createApiJsonBodyParser } = require('../dist/request-body-parser');

const startParserServer = async () => {
  const app = express();
  app.use(createApiJsonBodyParser());
  app.use((_request, response) => response.status(200).send('parsed'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
};

const postJson = async (url, path, body) => fetch(url + path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body,
});

test('ordinary API JSON requests retain the 1 MiB body limit', async () => {
  const server = await startParserServer();
  try {
    const response = await postJson(server.url, '/api/auth/login', JSON.stringify({ payload: 'x'.repeat(1024 * 1024) }));
    assert.equal(response.status, 413);
  } finally {
    await server.close();
  }
});

test('feed posts and organization documents accept four 5 MiB Base64 uploads', async () => {
  const server = await startParserServer();
  try {
    const fiveMiBImage = Buffer.alloc(5 * 1024 * 1024);
    fiveMiBImage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const encodedFiveMiBImage = fiveMiBImage.toString('base64');
    const attachments = Array.from({ length: 4 }, (_, index) => ({
      name: `attachment-${index}.png`,
      type: 'image/png',
      data: encodedFiveMiBImage,
    }));
    const body = JSON.stringify({ type: 'post', title: 'Test', body: 'Maximum attachment envelope', attachments });
    assert.ok(Buffer.byteLength(body) < 28 * 1024 * 1024);
    const feedResponse = await postJson(server.url, '/api/feed/posts', body);
    assert.equal(feedResponse.status, 200);

    const organizationBody = JSON.stringify({ files: attachments.map((file) => ({
      fileName: file.name,
      mimeType: file.type,
      dataBase64: file.data,
    })) });
    assert.ok(Buffer.byteLength(organizationBody) < 28 * 1024 * 1024);
    const organizationResponse = await postJson(
      server.url,
      '/api/organizations/123e4567-e89b-12d3-a456-426614174000/documents',
      organizationBody,
    );
    assert.equal(organizationResponse.status, 200);
  } finally {
    await server.close();
  }
});

test('the larger JSON allowance is not granted to unrelated routes, malformed organization IDs, or other methods', async () => {
  const server = await startParserServer();
  try {
    const body = JSON.stringify({ payload: 'x'.repeat(1024 * 1024) });
    const otherFeedRoute = await postJson(server.url, '/api/feed/posts/123/comments', body);
    const malformedOrganizationPath = await postJson(server.url, '/api/organizations/not-a-uuid/documents', body);
    const wrongMethod = await fetch(server.url + '/api/feed/posts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    });
    assert.equal(otherFeedRoute.status, 413);
    assert.equal(malformedOrganizationPath.status, 413);
    assert.equal(wrongMethod.status, 413);
  } finally {
    await server.close();
  }
});
