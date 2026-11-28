#!/usr/bin/env node

import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION = '0.2.0';
const CONFIG_FILE = '.verificationrc.json';
const DEFAULT_SERVICE_URL = 'https://api.verification.metadusk.com';
const CATALOG_PATH = new URL('../catalog/products.json', import.meta.url);

async function catalog() {
  return JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
}

function help() {
  process.stdout.write(`Verification CLI v${VERSION}

Usage:
  verification init [--url <service-url>]
  verification products
  verification versions <product>
  verification install <product>@<version>
  verification list
  verification remove <product>
  verification doctor
  verification --version
  verification --help

Products are selected and versioned independently. Installing a product records
the selection in this project; hosted entitlement and provider availability
must be provisioned separately by the platform.
`);
}

function normalizeServiceUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('The service URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  return parsed.origin;
}

async function readConfig() {
  try {
    const value = JSON.parse(await readFile(resolve(process.cwd(), CONFIG_FILE), 'utf8'));
    if (value.version !== 1 || typeof value.serviceUrl !== 'string') throw new Error('Invalid config schema.');
    value.serviceUrl = normalizeServiceUrl(value.serviceUrl);
    value.products ??= {};
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`No valid ${CONFIG_FILE} found. Run "verification init" first.`);
    throw error;
  }
}

async function writeConfig(config, { createOnly = false } = {}) {
  const path = resolve(process.cwd(), CONFIG_FILE);
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    if (createOnly) {
      // link() is an atomic create-if-absent operation on the same filesystem.
      const { link } = await import('node:fs/promises');
      await link(temp, path);
      await unlink(temp);
    } else {
      await rename(temp, path);
    }
  } catch (error) {
    await unlink(temp).catch(() => {});
    if (error.code === 'EEXIST') throw new Error(`${CONFIG_FILE} already exists. Existing configuration was not overwritten.`);
    throw error;
  }
}

async function init(args) {
  const index = args.indexOf('--url');
  if (index >= 0 && !args[index + 1]) throw new Error('--url requires a value.');
  const serviceUrl = normalizeServiceUrl(index >= 0 ? args[index + 1] : DEFAULT_SERVICE_URL);
  await writeConfig({ version: 1, serviceUrl, products: {} }, { createOnly: true });
  process.stdout.write(`Initialized ${CONFIG_FILE}\nService: ${serviceUrl}\nNo API key or identity data was written.\n`);
}

async function products() {
  const data = await catalog();
  for (const product of data.products) process.stdout.write(`${product.id.padEnd(24)} ${product.name}\n`);
}

async function versions(productId) {
  const data = await catalog();
  const product = data.products.find((item) => item.id === productId);
  if (!product) throw new Error(`Unknown product "${productId}". Run "verification products".`);
  process.stdout.write(`${product.id} — ${product.name}\n`);
  for (const release of product.versions) process.stdout.write(`  ${release.version}  ${release.status}\n`);
}

async function install(spec) {
  const match = /^([a-z][a-z0-9-]*)@([0-9]+\\.[0-9]+\\.[0-9]+)$/.exec(spec ?? '');
  if (!match) throw new Error('Use an explicit product version, for example: verification install kyc@1.0.0');
  const [, productId, version] = match;
  const data = await catalog();
  const product = data.products.find((item) => item.id === productId);
  if (!product) throw new Error(`Unknown product "${productId}". Run "verification products".`);
  const release = product.versions.find((item) => item.version === version);
  if (!release) throw new Error(`Version ${version} is not published for ${productId}. Run "verification versions ${productId}".`);
  if (release.status !== 'catalogue') throw new Error(`Version ${version} is not installable: ${release.status}.`);
  const config = await readConfig();
  config.products[productId] = { version, installedAt: new Date().toISOString(), status: 'selected' };
  await writeConfig(config);
  process.stdout.write(`Selected ${productId}@${version} for this project.\nThis records product selection only; it does not activate a hosted entitlement or connect a verification provider.\n`);
}

async function listInstalled() {
  const config = await readConfig();
  const entries = Object.entries(config.products);
  if (!entries.length) return process.stdout.write('No products selected. Run "verification products" to browse.\n');
  for (const [id, item] of entries) process.stdout.write(`${id}@${item.version}  ${item.status}\n`);
}

async function remove(productId) {
  if (!productId) throw new Error('Specify a product to remove.');
  const config = await readConfig();
  if (!Object.hasOwn(config.products, productId)) throw new Error(`Product "${productId}" is not selected in this project.`);
  delete config.products[productId];
  await writeConfig(config);
  process.stdout.write(`Removed ${productId} from this project configuration.\n`);
}

async function doctor() {
  const config = await readConfig();
  const response = await fetch(new URL('/health/live', config.serviceUrl), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Service health check failed with HTTP ${response.status}.`);
  process.stdout.write(`Service is reachable: ${config.serviceUrl}\n`);
}

export async function run(argv = process.argv.slice(2)) {
  const [command, ...args] = argv;
  if (command === 'init') await init(args);
  else if (command === 'products') await products();
  else if (command === 'versions') await versions(args[0]);
  else if (command === 'install') await install(args[0]);
  else if (command === 'list') await listInstalled();
  else if (command === 'remove') await remove(args[0]);
  else if (command === 'doctor') await doctor();
  else if (command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
  else help();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await run();
  } catch (error) {
    process.stderr.write(`verification: ${error.message}\n`);
    process.exitCode = 1;
  }
}
