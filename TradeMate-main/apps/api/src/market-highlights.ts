import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

/**
 * GET /api/market/highlights?division=<division>
 *
 * Feeds the four-slide ad banner at the top of each marketplace category page
 * (Trending now, Top contract, Best seller, Weekly trending). Everything is
 * computed from real TradeMate records; a slide is null when there is no
 * qualifying activity yet, and the web app shows an honest empty state for it.
 *
 * Privacy: agreed contract amounts and buyers are never returned. Only public
 * listing fields (title, listed price, seller business name) and aggregate
 * counts leave the server.
 */
const DIVISIONS = new Set([
  'services', 'real_estate', 'software', 'b2b', 'industrial_trade',
  'agriculture', 'finance_investment', 'institution_infrastructure', 'sports', 'entertainment',
]);
const CACHE_MS = 60_000;

const LISTING_COLUMNS = `l.id, l.title, l.price_minor_units::text AS price_minor_units, l.currency_code, o.name AS seller_name`;

export function attachMarketHighlights(app: INestApplication): void {
  const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
        connectionTimeoutMillis: 5000,
        max: 2,
      })
    : null;
  const cache = new Map<string, { expires: number; body: unknown }>();

  const mostEnquired = async (division: string, window: string) => {
    const result = await pool!.query(
      `SELECT ${LISTING_COLUMNS}, COUNT(e.id)::int AS enquiries
         FROM listings l
         JOIN organizations o ON o.id = l.seller_organization_id
         JOIN marketplace_enquiries e ON e.listing_id = l.id AND e.created_at >= now() - $2::interval
        WHERE l.status = 'published' AND o.status = 'active' AND l.division = $1
        GROUP BY l.id, o.name
        ORDER BY enquiries DESC, l.created_at DESC
        LIMIT 1`,
      [division, window],
    );
    const row = result.rows[0];
    return row ? { listing: pick(row), enquiries: row.enquiries as number } : null;
  };

  const topContract = async (division: string) => {
    // Ordered by the agreed amount, but the amount itself is never returned.
    const result = await pool!.query(
      `SELECT ${LISTING_COLUMNS}
         FROM marketplace_contracts c
         JOIN listings l ON l.id = c.listing_id
         JOIN organizations o ON o.id = l.seller_organization_id
        WHERE l.status = 'published' AND o.status = 'active' AND l.division = $1
          AND c.status IN ('accepted', 'completed')
        ORDER BY c.amount_minor_units DESC, c.created_at DESC
        LIMIT 1`,
      [division],
    );
    const row = result.rows[0];
    return row ? { listing: pick(row) } : null;
  };

  const bestSeller = async (division: string) => {
    const result = await pool!.query(
      `SELECT o.name AS seller_name, COUNT(*)::int AS deals,
              (SELECT l2.title FROM listings l2
                WHERE l2.seller_organization_id = o.id AND l2.division = $1 AND l2.status = 'published'
                ORDER BY l2.created_at DESC LIMIT 1) AS listing_title
         FROM marketplace_contracts c
         JOIN listings l ON l.id = c.listing_id
         JOIN organizations o ON o.id = c.seller_organization_id
        WHERE l.division = $1 AND o.status = 'active' AND c.status IN ('accepted', 'completed')
        GROUP BY o.id, o.name
        ORDER BY deals DESC, o.name
        LIMIT 1`,
      [division],
    );
    const row = result.rows[0];
    return row ? { seller: row.seller_name as string, deals: row.deals as number, listingTitle: (row.listing_title as string | null) || null } : null;
  };

  const pick = (row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    priceMinorUnits: row.price_minor_units as string,
    currency: row.currency_code as string,
    seller: row.seller_name as string,
  });

  app.getHttpAdapter().getInstance().get('/api/market/highlights', async (request: Request, response: Response) => {
    const division = String(request.query.division || '');
    if (!DIVISIONS.has(division)) {
      response.status(400).json({ message: 'division must be a valid marketplace category.' });
      return;
    }
    if (!pool) {
      response.json({ division, slides: { trending: null, topContract: null, bestSeller: null, weeklyTrending: null } });
      return;
    }
    const hit = cache.get(division);
    if (hit && hit.expires > Date.now()) {
      response.set('Cache-Control', 'public, max-age=60').json(hit.body);
      return;
    }
    try {
      const [trending, top, seller, weekly] = await Promise.all([
        mostEnquired(division, '24 hours'),
        topContract(division),
        bestSeller(division),
        mostEnquired(division, '7 days'),
      ]);
      const body = { division, slides: { trending, topContract: top, bestSeller: seller, weeklyTrending: weekly } };
      cache.set(division, { expires: Date.now() + CACHE_MS, body });
      response.set('Cache-Control', 'public, max-age=60').json(body);
    } catch {
      response.status(503).json({ message: 'Highlights are temporarily unavailable.' });
    }
  });
}
