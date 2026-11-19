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

test('feed-post creation accepts the encoded-size envelope for four 5 MiB attachments', async () => {
  const server = await startParserServer();
  try {
    const encodedFiveMiB = 'A'.repeat(Math.ceil((5 * 1024 * 1024) / 3) * 4);
    const attachments = Array.from({ length: 4 }, (_, index) => ({
      name: `attachment-${index}.bin`,
      type: 'application/octet-stream',
      data: encodedFiveMiB,
    }));
    const body = JSON.stringify({ type: 'post', title: 'Test', body: 'Maximum attachment envelope', attachments });
    assert.ok(Buffer.byteLength(body) < 28 * 1024 * 1024);
    const response = await postJson(server.url, '/api/feed/posts', body);
    assert.equal(response.status, 200);
  } finally {
    await server.close();
  }
});

test('the larger JSON allowance is not granted to other feed routes or methods', async () => {
  const server = await startParserServer();
  try {
    const body = JSON.stringify({ payload: 'x'.repeat(1024 * 1024) });
    const otherFeedRoute = await postJson(server.url, '/api/feed/posts/123/comments', body);
    const wrongMethod = await fetch(server.url + '/api/feed/posts', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body,
    });
    assert.equal(otherFeedRoute.status, 413);
    assert.equal(wrongMethod.status, 413);
  } finally {
    await server.close();
  }
});
