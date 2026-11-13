const assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const path = require('node:path');
const { Pool } = require('pg');

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function main() {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error('Pass the output JSON path as the first argument.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const suffix = randomUUID();
  const buyerToken = randomBytes(32).toString('base64url');
  const sellerToken = randomBytes(32).toString('base64url');

  try {
    const organization = await pool.query(
      "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, 'business', 'NG', 'NGN', 'active') RETURNING id",
      ['Live browser seller ' + suffix],
    );
    const organizationId = organization.rows[0].id;

    const actors = {};
    for (const [role, token] of [['buyer', buyerToken], ['seller', sellerToken]]) {
      const email = role + '-' + suffix + '@example.invalid';
      const user = await pool.query(
        "INSERT INTO users (email, display_name, country_code, status, email_verified_at) VALUES ($1, $2, 'NG', 'active', now()) RETURNING id",
        [email, role === 'buyer' ? 'Browser Buyer' : 'Browser Seller'],
      );
      const userId = user.rows[0].id;
      await pool.query(
        "INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '30 minutes')",
        [userId, digest(token)],
      );
      actors[role] = { id: userId, email, token };
    }

    await pool.query(
      "INSERT INTO organization_members (organization_id, user_id, member_role) VALUES ($1, $2, 'owner')",
      [organizationId, actors.seller.id],
    );

    const listing = await pool.query(
      "INSERT INTO listings (seller_organization_id, title, description, listing_type, price_minor_units, currency_code, country_code, status) VALUES ($1, $2, 'A disposable live-browser acceptance service listing.', 'service', 125000, 'NGN', 'NG', 'published') RETURNING id",
      [organizationId, 'Live browser service ' + suffix],
    );
    const b2bListing = await pool.query(
      "INSERT INTO listings (seller_organization_id, title, description, listing_type, price_minor_units, currency_code, country_code, quantity_available, status) VALUES ($1, $2, 'A disposable B2B offer for live enquiry acceptance.', 'b2b', 250000, 'NGN', 'NG', 1250, 'published') RETURNING id",
      [organizationId, 'Live browser B2B offer ' + suffix],
    );
    const contract = await pool.query(
      "INSERT INTO marketplace_contracts (listing_id, buyer_user_id, seller_organization_id, title, scope, terms, amount_minor_units, currency_code, status) VALUES ($1, $2, $3, $4, $5, $6, 125000, 'NGN', 'proposed') RETURNING id",
      [listing.rows[0].id, actors.buyer.id, organizationId, 'Live two-account acceptance ' + suffix, 'Deliver the agreed service and provide the completed work.', 'Both parties review the deliverables and confirm fulfilment.'],
    );

    const fixture = {
      buyer: actors.buyer,
      seller: actors.seller,
      contractId: contract.rows[0].id,
      contractTitle: 'Live two-account acceptance ' + suffix,
      b2bListingId: b2bListing.rows[0].id,
      b2bListingTitle: 'Live browser B2B offer ' + suffix,
    };
    await writeFile(path.resolve(outputPath), JSON.stringify(fixture), { mode: 0o600 });
    console.log('Created disposable live-browser fixture for two independent accounts.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Live-browser fixture creation failed:', error);
  process.exitCode = 1;
});
