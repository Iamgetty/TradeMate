const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for database role tests.');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const bootstrap = await readFile(path.join(__dirname, '..', 'database', 'security', '001_role_bootstrap.sql'), 'utf8');
    const assertions = await readFile(path.join(__dirname, '..', 'database', 'security', '002_role_bootstrap_test.sql'), 'utf8');
    await pool.query(bootstrap);
    await pool.query(assertions);
    console.log('PostgreSQL role bootstrap and least-privilege assertions passed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Database role security test failed:', error.message);
  process.exitCode = 1;
});
