'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRlsPilotConnectionString } = require('../scripts/test-rls-pilot');

test('RLS pilot refuses to fall back to the generic DATABASE_URL', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({
      DATABASE_URL: 'postgres://postgres:secret@localhost:5432/trademate_test',
    }),
    /RLS_PILOT_TEST_DATABASE_URL is required/,
  );
});

test('RLS pilot accepts an explicitly named local test database', () => {
  const connectionString = 'postgres://postgres:test@127.0.0.1:5432/trademate_test';
  assert.equal(
    resolveRlsPilotConnectionString({ RLS_PILOT_TEST_DATABASE_URL: connectionString }),
    connectionString,
  );
});

test('RLS pilot rejects non-loopback database hosts', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({
      RLS_PILOT_TEST_DATABASE_URL: 'postgres://user:pass@db.example.com:5432/trademate_test',
    }),
    /loopback PostgreSQL host/,
  );
});

test('RLS pilot rejects database names without a test or CI marker', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({
      RLS_PILOT_TEST_DATABASE_URL: 'postgres://user:pass@localhost:5432/trademate',
    }),
    /must explicitly identify a test\/CI database/,
  );
});

test('RLS pilot rejects malformed and non-PostgreSQL URLs', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({ RLS_PILOT_TEST_DATABASE_URL: 'not-a-url' }),
    /valid PostgreSQL URL/,
  );
  assert.throws(
    () => resolveRlsPilotConnectionString({ RLS_PILOT_TEST_DATABASE_URL: 'mysql://localhost/trademate_test' }),
    /requires a PostgreSQL connection URL/,
  );
});

test('RLS pilot rejects URL query parameters that could override connection settings', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({
      RLS_PILOT_TEST_DATABASE_URL: 'postgres://user:pass@localhost:5432/trademate_test?host=db.example.com',
    }),
    /must not contain query parameters or a fragment/,
  );
});

test('RLS pilot rejects URL fragments', () => {
  assert.throws(
    () => resolveRlsPilotConnectionString({
      RLS_PILOT_TEST_DATABASE_URL: 'postgres://user:pass@localhost:5432/trademate_test#production',
    }),
    /must not contain query parameters or a fragment/,
  );
});
