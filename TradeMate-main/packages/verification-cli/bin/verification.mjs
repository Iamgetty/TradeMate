#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSION = '0.1.0';
const CONFIG_FILE = '.verificationrc.json';
const DEFAULT_SERVICE_URL = 'https://api.verification.metadusk.com';

function help() {
  process.stdout.write(`Verification CLI v${VERSION}

Usage:
  verification init [--url <service-url>]
  verification doctor
  verification --version
  verification --help

The CLI configures access to the hosted verification service.
It does not perform identity checks locally.
`);
}

function normalizeServiceUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('The service URL must use HTTPS (HTTP is allowed only for localhost).');
  }
  return parsed.origin;
}

async function init(args) {
  const urlIndex = args.indexOf('--url');
  const serviceUrl = normalizeServiceUrl(urlIndex >= 0 ? args[urlIndex + 1] : DEFAULT_SERVICE_URL);
  const path = resolve(process.cwd(), CONFIG_FILE);
  let existing;
  try {
    existing = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing?.apiKey || existing?.token || existing?.secret) {
    throw new Error('Refusing to overwrite a config file containing a possible secret. Remove the secret safely and retry.');
  }
  const config = { version: 1, serviceUrl };
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    .catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
      await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    });
  process.stdout.write(`Initialized ${CONFIG_FILE}\nService: ${serviceUrl}\nNo API key or identity data was written.\n`);
}

async function doctor() {
  let config;
  try {
    config = JSON.parse(await readFile(resolve(process.cwd(), CONFIG_FILE), 'utf8'));
  } catch {
    throw new Error(`No valid ${CONFIG_FILE} found. Run "verification init" first.`);
  }
  const serviceUrl = normalizeServiceUrl(config.serviceUrl);
  const response = await fetch(new URL('/health/live', serviceUrl), {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Service health check failed with HTTP ${response.status}.`);
  process.stdout.write(`Service is reachable: ${serviceUrl}\n`);
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'init') await init(args);
  else if (command === 'doctor') await doctor();
  else if (command === '--version' || command === '-v') process.stdout.write(`${VERSION}\n`);
  else help();
} catch (error) {
  process.stderr.write(`verification: ${error.message}\n`);
  process.exitCode = 1;
}
