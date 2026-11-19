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

test('feed-post creation receives the larger JSON allowance', async () => {
  const server = await startParserServer();
  try {
    const response = await postJson(server.url, '/api/feed/posts', JSON.stringify({ attachments: [], payload: 'x'.repeat(1024 * 1024) }));
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
