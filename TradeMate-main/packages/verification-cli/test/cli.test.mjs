import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, '../bin/verification.mjs');

async function withProject(fn) {
  const cwd = await mkdtemp(join(tmpdir(), 'verification-cli-'));
  try { await fn(cwd); } finally { await rm(cwd, { recursive: true, force: true }); }
}

function run(cwd, ...args) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('catalogue lists independently selectable products', () => {
  const result = run(process.cwd(), 'products');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /kyc/);
  assert.match(result.stdout, /kyb/);
});

test('product selection requires an explicit published version', async () => {
  await withProject(async (cwd) => {
    assert.equal(run(cwd, 'init', '--url', 'https://verify.example.test').status, 0);
    const result = run(cwd, 'install', 'kyc@1.0.0');
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(await readFile(join(cwd, '.verificationrc.json'), 'utf8'));
    assert.equal(config.products.kyc.version, '1.0.0');
    assert.equal(config.products.kyb, undefined);
    assert.match(result.stdout, /does not activate a hosted entitlement/);
  });
});

test('unknown versions are rejected without changing selection', async () => {
  await withProject(async (cwd) => {
    run(cwd, 'init');
    const result = run(cwd, 'install', 'kyc@9.9.9');
    assert.notEqual(result.status, 0);
    const config = JSON.parse(await readFile(join(cwd, '.verificationrc.json'), 'utf8'));
    assert.deepEqual(config.products, {});
  });
});

test('init never overwrites an existing project configuration', async () => {
  await withProject(async (cwd) => {
    run(cwd, 'init');
    const before = await readFile(join(cwd, '.verificationrc.json'), 'utf8');
    const result = run(cwd, 'init', '--url', 'https://other.example.test');
    assert.notEqual(result.status, 0);
    assert.equal(await readFile(join(cwd, '.verificationrc.json'), 'utf8'), before);
  });
});

test('products can be listed and removed independently', async () => {
  await withProject(async (cwd) => {
    run(cwd, 'init');
    run(cwd, 'install', 'kyc@1.0.0');
    run(cwd, 'install', 'kyb@1.0.0');
    assert.match(run(cwd, 'list').stdout, /kyc@1.0.0/);
    assert.match(run(cwd, 'list').stdout, /kyb@1.0.0/);
    assert.equal(run(cwd, 'remove', 'kyc').status, 0);
    const config = JSON.parse(await readFile(join(cwd, '.verificationrc.json'), 'utf8'));
    assert.equal(config.products.kyc, undefined);
    assert.equal(config.products.kyb.version, '1.0.0');
  });
});
