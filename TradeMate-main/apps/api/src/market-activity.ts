import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Pool } from 'pg';

/**
 * GET /api/market/activity?division=<division>
 *
 * Feeds the animated slides at the top of each marketplace category page:
 *  - a 14-day activity line (new listings, enquiries, agreed deals per day),
 *  - headline stats,
 *  - the most-enquired and most recent listings ("top activities").
 *
 * Everything is a real count from TradeMate records. Nothing is estimated; a
 * category with no activity returns zeros and the web app says so.
 *
 * Privacy: only counts and public listing titles leave the server. Contract
 * amounts, buyers and enquiry text are never returned.
 */
const DIVISIONS = new Set([
  'services', 'real_estate', 'software', 'b2b', 'industrial_trade',
  'agriculture', 'finance_investment', 'institution_infrastructure', 'sports', 'entertainment',
]);
const CACHE_MS = 60_000;
const DAYS = 14;

export function attachMarketActivity(app: INestApplication): void {
  const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
        connectionTimeoutMillis: 5000,
        max: 2,
      })
    : null;
  const cache = new Map<string, { expires: number; body: unknown }>();

  const empty = (division: string) => ({
    division,
    days: [] as string[],
    series: { listings: [] as number[], enquiries: [] as number[], deals: [] as number[] },
    stats: { listings: 0, newThisWeek: 0, newPrevWeek: 0, enquiries7d: 0, deals7d: 0 },
    top: [] as Array<{ title: string; enquiries: number }>,
    recent: [] as Array<{ title: string }>,
  });

  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

  app.getHttpAdapter().getInstance().get('/api/market/activity', async (request: Request, response: Response) => {
    const division = String(request.query.division || '');
    if (!DIVISIONS.has(division)) {
      response.status(400).json({ message: 'division must be a valid marketplace category.' });
      return;
    }
    if (!pool) {
      response.json(empty(division));
      return;
    }
    const hit = cache.get(division);
    if (hit && hit.expires > Date.now()) {
      response.set('Cache-Control', 'public, max-age=60').json(hit.body);
      return;
    }
    try {
      const [daily, total, top, recent] = await Promise.all([
        pool.query(
          `WITH d AS (SELECT generate_series(current_date - ($2::int - 1), current_date, interval '1 day')::date AS day)
           SELECT d.day::text AS day,
             (SELECT COUNT(*) FROM listings l JOIN organizations o ON o.id = l.seller_organization_id
               WHERE l.division = $1 AND l.status = 'published' AND o.status = 'active' AND l.created_at::date = d.day)::int AS listings,
             (SELECT COUNT(*) FROM marketplace_enquiries e JOIN listings l ON l.id = e.listing_id
               WHERE l.division = $1 AND e.created_at::date = d.day)::int AS enquiries,
             (SELECT COUNT(*) FROM marketplace_contracts c JOIN listings l ON l.id = c.listing_id
               WHERE l.division = $1 AND c.status IN ('accepted', 'completed') AND c.created_at::date = d.day)::int AS deals
           FROM d ORDER BY d.day`,
          [division, DAYS],
        ),
        pool.query(
          `SELECT COUNT(*)::int AS listings FROM listings l JOIN organizations o ON o.id = l.seller_organization_id
            WHERE l.division = $1 AND l.status = 'published' AND o.status = 'active'`,
          [division],
        ),
        pool.query(
          `SELECT l.title, COUNT(e.id)::int AS enquiries
             FROM listings l
             JOIN organizations o ON o.id = l.seller_organization_id
             JOIN marketplace_enquiries e ON e.listing_id = l.id AND e.created_at >= now() - interval '7 days'
            WHERE l.division = $1 AND l.status = 'published' AND o.status = 'active'
            GROUP BY l.id
            ORDER BY enquiries DESC, l.created_at DESC
            LIMIT 3`,
          [division],
        ),
        pool.query(
          `SELECT l.title FROM listings l JOIN organizations o ON o.id = l.seller_organization_id
            WHERE l.division = $1 AND l.status = 'published' AND o.status = 'active'
            ORDER BY l.created_at DESC LIMIT 3`,
          [division],
        ),
      ]);

      const days = daily.rows.map((row) => row.day as string);
      const listings = daily.rows.map((row) => row.listings as number);
      const enquiries = daily.rows.map((row) => row.enquiries as number);
      const deals = daily.rows.map((row) => row.deals as number);
      const body = {
        division,
        days,
        series: { listings, enquiries, deals },
        stats: {
          listings: (total.rows[0]?.listings as number) || 0,
          newThisWeek: sum(listings.slice(-7)),
          newPrevWeek: sum(listings.slice(-14, -7)),
          enquiries7d: sum(enquiries.slice(-7)),
          deals7d: sum(deals.slice(-7)),
        },
        top: top.rows.map((row) => ({ title: row.title as string, enquiries: row.enquiries as number })),
        recent: recent.rows.map((row) => ({ title: row.title as string })),
      };
      cache.set(division, { expires: Date.now() + CACHE_MS, body });
      response.set('Cache-Control', 'public, max-age=60').json(body);
    } catch {
      response.status(503).json({ message: 'Activity is temporarily unavailable.' });
    }
  });
}
