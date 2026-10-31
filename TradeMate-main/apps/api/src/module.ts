import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, HttpException, HttpStatus, Module, NotFoundException, OnModuleDestroy, Param, Post, Patch, Delete, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';

const deriveScrypt = (password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
const SESSION_COOKIE = 'trademate_session';
const SESSION_DAYS = 7;
const passwordHash = async (password: string) => {
  const salt = randomBytes(16);
  const derived = await deriveScrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', '16384', '8', '1', salt.toString('hex'), derived.toString('hex')].join(String.fromCharCode(36));
};
const passwordMatches = async (password: string, encoded: string) => {
  const parts = encoded.split(String.fromCharCode(36));
  if (parts.length !== 6 || parts[0] !== 'scrypt' || parts[1] !== '16384' || parts[2] !== '8' || parts[3] !== '1') return false;
  try {
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await deriveScrypt(password, salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(actual, expected);
  } catch { return false; }
};
const tokenDigest = (token: string) => createHash('sha256').update(token).digest('hex');
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
const sessionTokenFrom = (request: Request) => {
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(SESSION_COOKIE + '='));
  return cookie ? decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)) : '';
};
const databasePool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 5 })
  : null;

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'trademate-api', stage: 'marketplace-foundation', timestamp: new Date().toISOString() };
  }

  @Get('health/database')
  async databaseHealth() {
    if (!databasePool) {
      return { status: 'not_configured', database: { configured: false, connected: false } };
    }
    try {
      await databasePool.query('SELECT 1');
      return { status: 'ok', database: { configured: true, connected: true } };
    } catch {
      return { status: 'error', database: { configured: true, connected: false } };
    }
  }
}

@Controller('auth')
class AuthController {
  @Post('register')
  async register(@Body() body: { email?: string; password?: string; displayName?: string }, @Res({ passthrough: true }) response: Response) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address.');
    if (displayName.length < 2 || displayName.length > 80) throw new BadRequestException('Your name must be between 2 and 80 characters.');
    if (password.length < 12 || password.length > 128) throw new BadRequestException('Use a password between 12 and 128 characters.');
    const hash = await passwordHash(password);
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query("INSERT INTO users (email, display_name, status) VALUES ($1, $2, 'active') RETURNING id, email, display_name, country_code, created_at", [email, displayName]);
      await client.query('INSERT INTO user_credentials (user_id, password_hash) VALUES ($1, $2)', [created.rows[0].id, hash]);
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await client.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [created.rows[0].id, tokenDigest(token), expiresAt]);
      await client.query('COMMIT');
      response.cookie(SESSION_COOKIE, token, cookieOptions());
      return { user: created.rows[0] };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('An account with this email already exists.');
      throw error;
    } finally { client.release(); }
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email?: string; password?: string }, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password || email.length > 254 || password.length > 128) throw new UnauthorizedException('Email or password is incorrect.');
    const rateKey = tokenDigest((request.ip || 'unknown') + '|' + email);
    const rate = await databasePool.query(
      "INSERT INTO auth_rate_limits (key_hash, window_started_at, attempts, blocked_until) VALUES ($1, now(), 1, NULL) ON CONFLICT (key_hash) DO UPDATE SET attempts = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END, window_started_at = CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN now() ELSE auth_rate_limits.window_started_at END, blocked_until = CASE WHEN (CASE WHEN auth_rate_limits.window_started_at < now() - interval '15 minutes' THEN 1 ELSE auth_rate_limits.attempts + 1 END) >= 10 THEN now() + interval '15 minutes' ELSE auth_rate_limits.blocked_until END RETURNING attempts, blocked_until",
      [rateKey],
    );
    if (rate.rows[0].attempts > 10 || (rate.rows[0].blocked_until && new Date(rate.rows[0].blocked_until).getTime() > Date.now())) {
      throw new HttpException('Too many sign-in attempts. Please wait 15 minutes before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const result = await databasePool.query("SELECT u.id, u.email, u.display_name, u.country_code, u.status, c.password_hash FROM users u JOIN user_credentials c ON c.user_id = u.id WHERE lower(u.email) = $1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user || user.status !== 'active' || !(await passwordMatches(password, user.password_hash))) throw new UnauthorizedException('Email or password is incorrect.');
    await databasePool.query('DELETE FROM auth_rate_limits WHERE key_hash = $1', [rateKey]);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await databasePool.query('INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [user.id, tokenDigest(token), expiresAt]);
    response.cookie(SESSION_COOKIE, token, cookieOptions());
    return { user: { id: user.id, email: user.email, display_name: user.display_name, country_code: user.country_code } };
  }

  @Get('me')
  async me(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('Authentication is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in.');
    const result = await databasePool.query("SELECT u.id, u.email, u.display_name, u.country_code FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1", [tokenDigest(token)]);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return { user: result.rows[0] };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = sessionTokenFrom(request);
    if (databasePool && token) await databasePool.query('DELETE FROM user_sessions WHERE token_hash = $1', [tokenDigest(token)]);
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' });
    return { success: true };
  }
}


@Controller('organizations')
class OrganizationsController {
  private async currentUser(request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.currentUser(request);
    const result = await databasePool!.query(
      `SELECT o.id, o.name, o.organization_type, o.country_code, o.default_currency, o.status, om.member_role, o.created_at
       FROM organization_members om JOIN organizations o ON o.id = om.organization_id
       WHERE om.user_id = $1 ORDER BY o.created_at DESC LIMIT 1`,
      [userId],
    );
    return { organization: result.rows[0] || null };
  }

  @Post()
  async create(@Req() request: Request, @Body() body: { name?: string; organizationType?: string; countryCode?: string; defaultCurrency?: string }) {
    const userId = await this.currentUser(request);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const organizationType = body?.organizationType;
    const countryCode = typeof body?.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
    const defaultCurrency = typeof body?.defaultCurrency === 'string' ? body.defaultCurrency.trim().toUpperCase() : '';
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Business name must be between 2 and 120 characters.');
    if (!['business', 'sole_trader', 'service_provider'].includes(organizationType || '')) {
      throw new BadRequestException('Choose a valid business type.');
    }
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new BadRequestException('Enter a valid two-letter country code.');
    if (!/^[A-Z]{3}$/.test(defaultCurrency)) throw new BadRequestException('Enter a valid three-letter currency code.');

    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query('SELECT organization_id FROM organization_members WHERE user_id = $1 LIMIT 1', [userId]);
      if (existing.rowCount) throw new ConflictException('A business space is already connected to this account.');
      const created = await client.query(
        "INSERT INTO organizations (name, organization_type, country_code, default_currency, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id, name, organization_type, country_code, default_currency, status, created_at",
        [name, organizationType, countryCode, defaultCurrency],
      );
      const organization = created.rows[0];
      await client.query(
        "INSERT INTO organization_members (organization_id, user_id, member_role) VALUES ($1, $2, 'owner')",
        [organization.id, userId],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'organization.created', 'organization', $2, $3::jsonb)",
        [userId, organization.id, JSON.stringify({ organization_type: organizationType, country_code: countryCode, default_currency: defaultCurrency })],
      );
      await client.query('COMMIT');
      return { organization: { ...organization, member_role: 'owner' } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

@Controller('market/listings')
class PublicListingsController {
  @Post()
  async createDraft(
    @Req() request: Request,
    @Body() body: { title?: string; description?: string; listingType?: string; price?: string | number; quantityAvailable?: string | number | null },
  ) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to create an offer.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const listingType = body?.listingType;
    const priceText = String(body?.price ?? '').trim();
    const quantityText = body?.quantityAvailable === null || body?.quantityAvailable === undefined || String(body.quantityAvailable).trim() === ''
      ? null : String(body.quantityAvailable).trim();
    if (title.length < 3 || title.length > 140) throw new BadRequestException('Offer title must be between 3 and 140 characters.');
    if (description.length > 5000) throw new BadRequestException('Description must be 5,000 characters or fewer.');
    if (!['b2b', 'service'].includes(listingType || '')) throw new BadRequestException('Choose a Services or B2B offer type.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (!/^\d{1,12}$/.test(quantityText) || !Number.isSafeInteger(Number(quantityText))) throw new BadRequestException('Quantity must be a whole number, or leave it blank.');
      quantity = Number(quantityText);
    }
    const membership = await databasePool.query(
      "SELECT o.id, o.country_code, o.default_currency, o.status FROM organization_members om JOIN organizations o ON o.id = om.organization_id WHERE om.user_id = $1 ORDER BY o.created_at DESC LIMIT 1",
      [userId],
    );
    if (!membership.rowCount) throw new BadRequestException('Create your business space before adding an offer.');
    const organization = membership.rows[0];
    const created = await databasePool.query(
      "INSERT INTO listings (seller_organization_id, title, description, listing_type, price_minor_units, currency_code, country_code, quantity_available, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft') RETURNING id, title, description, listing_type, price_minor_units::text AS price_minor_units, currency_code, country_code, quantity_available, status, created_at",
      [organization.id, title, description, listingType, priceMinorUnits, organization.default_currency, organization.country_code, quantity],
    );
    await databasePool.query(
      "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'listing.draft_created','listing',$3,$4::jsonb)",
      [userId, organization.id, created.rows[0].id, JSON.stringify({ listing_type: listingType, business_status: organization.status })],
    );
    return { listing: created.rows[0], message: 'Offer saved as a draft. It is not publicly visible yet.' };
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to view your offers.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.status, l.created_at, l.updated_at,
              o.name AS seller_name
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       ORDER BY l.created_at DESC, l.id
       LIMIT 100`,
      [session.rows[0].id],
    );
    return { data: result.rows };
  }


  @Post(':id/submit')
  async submitForReview(@Param('id') id: string, @Req() request: Request) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to submit an offer.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE listings l
         SET status = 'pending_review', review_submitted_at = now(), reviewed_at = NULL, review_note = NULL, updated_at = now()
         WHERE l.id = $1 AND l.status IN ('draft', 'rejected')
           AND EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2)
         RETURNING l.id, l.title, l.status, l.review_submitted_at`,
        [id, userId],
      );
      if (!result.rowCount) {
        const existing = await client.query(
          `SELECT l.status, EXISTS (SELECT 1 FROM organization_members om JOIN listings own ON own.seller_organization_id = om.organization_id WHERE own.id = l.id AND om.user_id = $2) AS is_owner
           FROM listings l WHERE l.id = $1`,
          [id, userId],
        );
        if (!existing.rowCount || !existing.rows[0].is_owner) throw new NotFoundException('Offer not found in your business space.');
        throw new ConflictException(`This offer cannot be submitted from its current status: ${existing.rows[0].status}.`);
      }
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) SELECT $1, l.seller_organization_id, 'listing.submitted_for_review', 'listing', l.id, '{}'::jsonb FROM listings l WHERE l.id = $2",
        [userId, id],
      );
      await client.query('COMMIT');
      return { listing: result.rows[0], message: 'Offer submitted for review. It will not appear publicly until approved.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id')
  async updateDraft(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { title?: string; description?: string; listingType?: string; price?: string | number; quantityAvailable?: string | number | null },
  ) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to edit an offer.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const listingType = body?.listingType;
    const priceText = String(body?.price ?? '').trim();
    const quantityText = body?.quantityAvailable === null || body?.quantityAvailable === undefined || String(body.quantityAvailable).trim() === ''
      ? null : String(body.quantityAvailable).trim();
    if (title.length < 3 || title.length > 140) throw new BadRequestException('Offer title must be between 3 and 140 characters.');
    if (description.length > 5000) throw new BadRequestException('Description must be 5,000 characters or fewer.');
    if (!['b2b', 'service'].includes(listingType || '')) throw new BadRequestException('Choose a Services or B2B offer type.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (listingType === 'service') throw new BadRequestException('Service offers cannot have a quantity.');
      if (!/^\d{1,12}$/.test(quantityText) || !Number.isSafeInteger(Number(quantityText))) throw new BadRequestException('Quantity must be a whole number, or leave it blank.');
      quantity = Number(quantityText);
    }
    const updated = await databasePool.query(
      `UPDATE listings l
       SET title = $1, description = $2, listing_type = $3, price_minor_units = $4, quantity_available = $5, updated_at = now()
       WHERE l.id = $6 AND l.status = 'draft'
         AND EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = l.seller_organization_id AND om.user_id = $7
         )
       RETURNING l.id, l.title, l.description, l.listing_type, l.price_minor_units::text AS price_minor_units,
                 l.currency_code, l.country_code, l.quantity_available, l.status, l.created_at, l.updated_at`,
      [title, description, listingType, priceMinorUnits, quantity, id, userId],
    );
    if (!updated.rowCount) {
      const exists = await databasePool.query('SELECT status FROM listings WHERE id = $1', [id]);
      if (!exists.rowCount) throw new NotFoundException('Offer not found.');
      if (exists.rows[0].status !== 'draft') throw new ConflictException('Only draft offers can be edited.');
      throw new NotFoundException('Offer not found in your business space.');
    }
    await databasePool.query(
      "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) SELECT $1, l.seller_organization_id, 'listing.draft_updated', 'listing', l.id, $2::jsonb FROM listings l WHERE l.id = $3",
      [userId, JSON.stringify({ listing_type: listingType }), id],
    );
    return { listing: updated.rows[0], message: 'Draft offer updated.' };
  }

  @Delete(':id')
  async deleteDraft(@Param('id') id: string, @Req() request: Request) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to delete an offer.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    const userId = session.rows[0].id as string;
    const deleted = await databasePool.query(
      `DELETE FROM listings l
       WHERE l.id = $1 AND l.status = 'draft'
         AND EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2
         )
       RETURNING l.id, l.seller_organization_id`,
      [id, userId],
    );
    if (!deleted.rowCount) {
      const exists = await databasePool.query('SELECT status FROM listings WHERE id = $1', [id]);
      if (!exists.rowCount) throw new NotFoundException('Offer not found.');
      if (exists.rows[0].status !== 'draft') throw new ConflictException('Only draft offers can be deleted.');
      throw new NotFoundException('Offer not found in your business space.');
    }
    await databasePool.query(
      "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'listing.draft_deleted', 'listing', $3, '{}'::jsonb)",
      [userId, deleted.rows[0].seller_organization_id, deleted.rows[0].id],
    );
    return { success: true, id: deleted.rows[0].id, message: 'Draft offer deleted.' };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException('id must be a valid listing UUID.');
    }
    if (!databasePool) {
      throw new NotFoundException('Listing not found.');
    }

    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.created_at, l.updated_at,
              o.name AS seller_name, o.country_code AS seller_country_code,
              c.name AS category_name,
              COALESCE((SELECT json_agg(json_build_object('url', lm.media_url, 'alt', lm.alt_text) ORDER BY lm.sort_order, lm.created_at)
                        FROM listing_media lm WHERE lm.listing_id = l.id), '[]'::json) AS media
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
       LIMIT 1`,
      [id],
    );
    if (!result.rowCount) throw new NotFoundException('Listing not found.');
    return { data: result.rows[0] };
  }

  @Get()
  async browse(
    @Query('q') search?: string,
    @Query('country') country?: string,
    @Query('type') type?: string,
    @Query('category') category?: string,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    if (!databasePool) {
      return { data: [], pagination: { page: 1, limit: 20, total: 0 }, message: 'Marketplace database is not configured.' };
    }

    const page = pageValue === undefined ? 1 : Number(pageValue);
    const limit = limitValue === undefined ? 20 : Number(limitValue);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('page must be a positive integer and limit must be between 1 and 50.');
    }
    if (type && !['b2b', 'service'].includes(type)) {
      throw new BadRequestException('type must be service or b2b.');
    }
    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      throw new BadRequestException('country must be a two-letter country code.');
    }
    if (category && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category)) {
      throw new BadRequestException('category must be a valid category UUID.');
    }

    const conditions = ["l.status = 'published'", "o.status = 'active'", "l.listing_type IN ('service', 'b2b')"];
    const values: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      conditions.push(clause.replace('?', `$${values.length}`));
    };

    if (search?.trim()) {
      const pattern = `%${search.trim().slice(0, 100)}%`;
      values.push(pattern, pattern);
      conditions.push(`(l.title ILIKE $${values.length - 1} OR l.description ILIKE $${values.length})`);
    }
    if (country) add('l.country_code = ?', country.toUpperCase());
    if (type) add('l.listing_type = ?', type);
    if (category) add('l.category_id = ?', category);

    const where = conditions.join(' AND ');
    const countResult = await databasePool.query(
      `SELECT COUNT(*)::int AS total FROM listings l JOIN organizations o ON o.id = l.seller_organization_id WHERE ${where}`,
      values,
    );
    const total = countResult.rows[0].total as number;
    const offset = (page - 1) * limit;
    const resultValues = [...values, limit, offset];
    const listingsResult = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.created_at,
              o.name AS seller_name, c.name AS category_name,
              (SELECT lm.media_url FROM listing_media lm WHERE lm.listing_id = l.id ORDER BY lm.sort_order, lm.created_at LIMIT 1) AS cover_image
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${where}
       ORDER BY l.created_at DESC, l.id
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      resultValues,
    );

    return {
      data: listingsResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}


@Controller('market/enquiries')
class EnquiriesController {
  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to use marketplace enquiries.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  @Post()
  async create(@Req() request: Request, @Body() body: { listingId?: string; message?: string }) {
    const userId = await this.authenticatedUser(request);
    const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
      throw new BadRequestException('listingId must be a valid listing UUID.');
    }
    if (message.length < 5 || message.length > 2000) {
      throw new BadRequestException('Your enquiry must be between 5 and 2,000 characters.');
    }

    const listing = await databasePool!.query(
      `SELECT l.id, l.seller_organization_id, o.name AS seller_name
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
       LIMIT 1`,
      [listingId],
    );
    if (!listing.rowCount) throw new NotFoundException('This listing is not available for enquiries.');
    const target = listing.rows[0];
    const sellerMembership = await databasePool!.query(
      'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
      [target.seller_organization_id, userId],
    );
    if (sellerMembership.rowCount) throw new BadRequestException('You cannot send an enquiry about your own listing.');

    const created = await databasePool!.query(
      "INSERT INTO marketplace_enquiries (listing_id, buyer_user_id, message, status) VALUES ($1, $2, $3, 'open') RETURNING id, listing_id, buyer_user_id, message, status, created_at",
      [listingId, userId, message],
    );
    await databasePool!.query(
      "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'marketplace.enquiry_created', 'enquiry', $3, $4::jsonb)",
      [userId, target.seller_organization_id, created.rows[0].id, JSON.stringify({ listing_id: listingId })],
    );
    return { data: { ...created.rows[0], seller_name: target.seller_name }, message: 'Enquiry sent to the seller.' };
  }

  private async authorizedEnquiry(enquiryId: string, userId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(enquiryId)) {
      throw new BadRequestException('id must be a valid enquiry UUID.');
    }
    const result = await databasePool!.query(
      `SELECT e.id, e.listing_id, e.buyer_user_id, e.message, e.status, e.created_at,
              l.seller_organization_id, l.title AS listing_title, o.name AS seller_name, buyer.display_name AS buyer_name
       FROM marketplace_enquiries e
       JOIN listings l ON l.id = e.listing_id
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN users buyer ON buyer.id = e.buyer_user_id
       WHERE e.id = $1
         AND (e.buyer_user_id = $2 OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = l.seller_organization_id AND om.user_id = $2
         ))
       LIMIT 1`,
      [enquiryId, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Enquiry not found.');
    return result.rows[0];
  }

  @Get(':id/messages')
  async messages(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const enquiry = await this.authorizedEnquiry(id, userId);
    const replies = await databasePool!.query(
      `SELECT m.id, m.enquiry_id, m.sender_user_id, u.display_name AS sender_name,
              m.message, m.created_at
       FROM enquiry_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.enquiry_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 500`,
      [id],
    );
    return { data: { enquiry, messages: [{ id: 'initial-' + enquiry.id, sender_user_id: enquiry.buyer_user_id, sender_name: enquiry.buyer_name, message: enquiry.message, created_at: enquiry.created_at, initial: true }, ...replies.rows] } };
  }

  @Post(':id/messages')
  async reply(@Param('id') id: string, @Req() request: Request, @Body() body: { message?: string }) {
    const userId = await this.authenticatedUser(request);
    const enquiry = await this.authorizedEnquiry(id, userId);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 2000) {
      throw new BadRequestException('Your message must be between 1 and 2,000 characters.');
    }
    if (enquiry.status === 'closed' || enquiry.status === 'reported') {
      throw new ConflictException('This enquiry is no longer open for replies.');
    }
    const isBuyer = enquiry.buyer_user_id === userId;
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      // Re-check the conversation status under a row lock to avoid a reply racing with closure.
      const locked = await client.query(
        'SELECT status FROM marketplace_enquiries WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!locked.rowCount) throw new NotFoundException('Enquiry not found.');
      if (locked.rows[0].status === 'closed' || locked.rows[0].status === 'reported') {
        throw new ConflictException('This enquiry is no longer open for replies.');
      }
      const inserted = await client.query(
        'INSERT INTO enquiry_messages (enquiry_id, sender_user_id, message) VALUES ($1, $2, $3) RETURNING id, enquiry_id, sender_user_id, message, created_at',
        [id, userId, message],
      );
      const sender = await client.query('SELECT display_name FROM users WHERE id = $1 LIMIT 1', [userId]);
      await client.query(
        `UPDATE marketplace_enquiries SET status = CASE WHEN $2 = true THEN 'responded' ELSE status END, updated_at = now() WHERE id = $1`,
        [id, !isBuyer],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, $2, 'marketplace.enquiry_message_sent', 'enquiry', $3, $4::jsonb)",
        [userId, enquiry.seller_organization_id, id, JSON.stringify({ direction: isBuyer ? 'buyer_reply' : 'seller_reply' })],
      );
      await client.query('COMMIT');
      return { data: { ...inserted.rows[0], sender_name: sender.rows[0]?.display_name ?? 'TradeMate user' }, message: 'Reply sent.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query(
      `SELECT e.id, e.listing_id, e.buyer_user_id, e.message, e.status, e.created_at, e.updated_at,
              l.title AS listing_title, l.currency_code, l.price_minor_units::text AS price_minor_units,
              o.name AS seller_name, buyer.display_name AS buyer_name,
              CASE WHEN e.buyer_user_id = $1 THEN 'sent' ELSE 'received' END AS direction
       FROM marketplace_enquiries e
       JOIN listings l ON l.id = e.listing_id
       JOIN organizations o ON o.id = l.seller_organization_id
       JOIN users buyer ON buyer.id = e.buyer_user_id
       WHERE e.buyer_user_id = $1
          OR EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = l.seller_organization_id AND om.user_id = $1
          )
       ORDER BY e.created_at DESC, e.id
       LIMIT 100`,
      [userId],
    );
    return { data: result.rows };
  }
}





@Controller('market/contracts')
class MarketplaceContractsController {
  private validateContractId(id: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      throw new BadRequestException("id must be a valid contract UUID.");
    }
  }

  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to manage contracts.');
    const session = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!session.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.rows[0].id as string;
  }

  private async authorizedContract(id: string, userId: string) {
    this.validateContractId(id);
    const result = await databasePool!.query(
      `SELECT c.*, l.title AS listing_title, l.listing_type, o.name AS seller_name,
              buyer.display_name AS buyer_name,
              (c.buyer_user_id = $2) AS is_buyer,
              EXISTS (
                SELECT 1 FROM organization_members om
                WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
              ) AS is_seller
       FROM marketplace_contracts c
       JOIN listings l ON l.id = c.listing_id
       JOIN organizations o ON o.id = c.seller_organization_id
       JOIN users buyer ON buyer.id = c.buyer_user_id
       WHERE c.id = $1
         AND (c.buyer_user_id = $2 OR EXISTS (
           SELECT 1 FROM organization_members om
           WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2
         ))
       LIMIT 1`,
      [id, userId],
    );
    if (!result.rowCount) throw new NotFoundException('Contract not found.');
    return result.rows[0];
  }

  @Post()
  async create(
    @Req() request: Request,
    @Body() body: {
      listingId?: string;
      amount?: string | number;
      scope?: string;
      terms?: string;
      startDate?: string;
      completionDate?: string;
    },
  ) {
    const buyerId = await this.authenticatedUser(request);
    const listingId = typeof body?.listingId === 'string' ? body.listingId.trim() : '';
    const amountText = String(body?.amount ?? '').trim();
    const scope = typeof body?.scope === 'string' ? body.scope.trim() : '';
    const terms = typeof body?.terms === 'string' ? body.terms.trim() : '';
    const startDate = typeof body?.startDate === 'string' && body.startDate.trim() ? body.startDate.trim() : null;
    const completionDate = typeof body?.completionDate === 'string' && body.completionDate.trim() ? body.completionDate.trim() : null;
    const validDate = (value: string | null) => value === null ||
      (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) &&
       new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listingId)) {
      throw new BadRequestException('listingId must be a valid offer UUID.');
    }
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(amountText)) {
      throw new BadRequestException('Enter a proposed contract value with up to two decimal places.');
    }
    if (scope.length < 5 || scope.length > 5000) {
      throw new BadRequestException('Contract scope must be between 5 and 5,000 characters.');
    }
    if (terms.length < 5 || terms.length > 10000) {
      throw new BadRequestException('Contract terms must be between 5 and 10,000 characters.');
    }
    if (!validDate(startDate) || !validDate(completionDate)) {
      throw new BadRequestException('Use valid dates in YYYY-MM-DD format.');
    }
    if (startDate && completionDate && completionDate < startDate) {
      throw new BadRequestException('The completion date cannot be before the start date.');
    }
    const amountParts = amountText.split(".");
    const amountMinorUnits = (BigInt(amountParts[0]) * 100n + BigInt(((amountParts[1] || "") + "00").slice(0, 2))).toString();

    const listing = await databasePool!.query(
      `SELECT l.id, l.title, l.listing_type, l.seller_organization_id, l.currency_code,
              l.status, o.status AS organization_status
       FROM listings l
       JOIN organizations o ON o.id = l.seller_organization_id
       WHERE l.id = $1 AND l.status = 'published' AND o.status = 'active'
         AND l.listing_type IN ('service', 'b2b')
       LIMIT 1`,
      [listingId],
    );
    if (!listing.rowCount) throw new NotFoundException('This published Services or B2B offer is not available for a contract.');
    const offer = listing.rows[0];
    const sellerMembership = await databasePool!.query(
      'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
      [offer.seller_organization_id, buyerId],
    );
    if (sellerMembership.rowCount) throw new BadRequestException('You cannot propose a contract to your own business space.');

    const created = await databasePool!.query(
      `INSERT INTO marketplace_contracts
       (listing_id, buyer_user_id, seller_organization_id, title, scope, terms,
        amount_minor_units, currency_code, requested_start_date, requested_completion_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed')
       RETURNING id, listing_id, buyer_user_id, seller_organization_id, title, scope, terms,
                 amount_minor_units::text AS amount_minor_units, currency_code,
                 requested_start_date, requested_completion_date, status, created_at`,
      [listingId, buyerId, offer.seller_organization_id, offer.title, scope, terms,
       String(amountMinorUnits), offer.currency_code, startDate, completionDate],
    );
    await databasePool!.query(
      "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_proposed','contract',$3,$4::jsonb)",
      [buyerId, offer.seller_organization_id, created.rows[0].id, JSON.stringify({ listing_id: listingId, listing_type: offer.listing_type })],
    );
    return { data: created.rows[0], message: 'Contract proposal sent to the business for review.' };
  }

  @Get('mine')
  async mine(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query(
      `SELECT c.id, c.listing_id, c.buyer_user_id, c.seller_organization_id, c.title,
              c.scope, c.terms, c.amount_minor_units::text AS amount_minor_units, c.currency_code,
              c.requested_start_date, c.requested_completion_date, c.status,
              c.accepted_at, c.buyer_confirmed_at, c.seller_confirmed_at, c.completed_at,
              c.created_at, c.updated_at, l.listing_type, o.name AS seller_name,
              buyer.display_name AS buyer_name,
              (SELECT om.member_role FROM organization_members om WHERE om.organization_id = c.seller_organization_id AND om.user_id = $1 LIMIT 1) AS seller_member_role,
              CASE WHEN c.buyer_user_id = $1 THEN 'sent' ELSE 'received' END AS direction
       FROM marketplace_contracts c
       JOIN listings l ON l.id = c.listing_id
       JOIN organizations o ON o.id = c.seller_organization_id
       JOIN users buyer ON buyer.id = c.buyer_user_id
       WHERE c.buyer_user_id = $1
          OR EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = c.seller_organization_id AND om.user_id = $1
          )
       ORDER BY c.created_at DESC, c.id
       LIMIT 100`,
      [userId],
    );
    return { data: result.rows };
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    return { data: await this.authorizedContract(id, userId) };
  }

  @Patch(':id/respond')
  async respond(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string },
  ) {
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    if (!['accept', 'reject'].includes(body?.decision || '')) {
      throw new BadRequestException('decision must be accept or reject.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.buyer_user_id, c.seller_organization_id,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2 AND om.member_role IN ('owner', 'admin')) AS can_manage_contract
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount) throw new NotFoundException('Contract not found.');
      if (!current.rows[0].can_manage_contract || current.rows[0].buyer_user_id === userId) throw new NotFoundException('Contract not found.');
      if (current.rows[0].status !== 'proposed') throw new ConflictException('This contract proposal is no longer awaiting a response.');
      const status = body.decision === 'accept' ? 'accepted' : 'rejected';
      const updated = await client.query(
        `UPDATE marketplace_contracts
         SET status = $2, accepted_by_user_id = CASE WHEN $2 = 'accepted' THEN $3 ELSE NULL END,
             accepted_at = CASE WHEN $2 = 'accepted' THEN now() ELSE NULL END, updated_at = now()
         WHERE id = $1
         RETURNING id, status, accepted_by_user_id, accepted_at, updated_at`,
        [id, status, userId],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,$3,'contract',$4,$5::jsonb)",
        [userId, current.rows[0].seller_organization_id, status === 'accepted' ? 'marketplace.contract_accepted' : 'marketplace.contract_rejected', id, JSON.stringify({ status })],
      );
      await client.query('COMMIT');
      return { data: updated.rows[0], message: status === 'accepted' ? 'Contract accepted.' : 'Contract proposal declined.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Req() request: Request) {
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT id, buyer_user_id, seller_organization_id, status FROM marketplace_contracts WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!current.rowCount || current.rows[0].buyer_user_id !== userId) throw new NotFoundException('Contract not found.');
      if (current.rows[0].status !== 'proposed') throw new ConflictException('Only a pending contract proposal can be cancelled.');
      const updated = await client.query(
        "UPDATE marketplace_contracts SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING id, status, updated_at",
        [id],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_cancelled','contract',$3,'{}'::jsonb)",
        [userId, current.rows[0].seller_organization_id, id],
      );
      await client.query('COMMIT');
      return { data: updated.rows[0], message: 'Contract proposal cancelled.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Patch(':id/confirm-completion')
  async confirmCompletion(@Param('id') id: string, @Req() request: Request) {
    this.validateContractId(id);
    const userId = await this.authenticatedUser(request);
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.buyer_user_id, c.seller_organization_id,
                c.buyer_confirmed_at, c.seller_confirmed_at,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2 AND om.member_role IN ('owner', 'admin')) AS can_manage_contract
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount) throw new NotFoundException('Contract not found.');
      const contract = current.rows[0];
      const isBuyer = contract.buyer_user_id === userId;
      if (!isBuyer && !contract.can_manage_contract) throw new NotFoundException('Contract not found.');
      if (contract.status !== 'accepted') throw new ConflictException('Only an accepted contract can be confirmed as fulfilled.');
      const buyerConfirmed = Boolean(contract.buyer_confirmed_at) || isBuyer;
      const sellerActor = Boolean(contract.is_seller) && !isBuyer;
      const sellerConfirmed = Boolean(contract.seller_confirmed_at) || sellerActor;
      const completed = buyerConfirmed && sellerConfirmed;
      const updated = await client.query(
        `UPDATE marketplace_contracts
         SET buyer_confirmed_at = CASE WHEN $2 THEN COALESCE(buyer_confirmed_at, now()) ELSE buyer_confirmed_at END,
             seller_confirmed_at = CASE WHEN $3 THEN COALESCE(seller_confirmed_at, now()) ELSE seller_confirmed_at END,
             status = CASE WHEN $4 THEN 'completed' ELSE status END,
             completed_at = CASE WHEN $4 THEN COALESCE(completed_at, now()) ELSE completed_at END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, status, buyer_confirmed_at, seller_confirmed_at, completed_at, updated_at`,
        [id, isBuyer, sellerActor, completed],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_fulfilment_confirmed','contract',$3,$4::jsonb)",
        [userId, contract.seller_organization_id, id, JSON.stringify({ completed })],
      );
      await client.query('COMMIT');
      return { data: updated.rows[0], message: completed ? 'Both parties confirmed fulfilment. Contract completed.' : 'Your confirmation is recorded. The other party must also confirm fulfilment.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  @Get(':id/messages')
  async messages(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const contract = await this.authorizedContract(id, userId);
    const result = await databasePool!.query(
      `SELECT m.id, m.contract_id, m.sender_user_id, u.display_name AS sender_name,
              m.message, m.created_at
       FROM marketplace_contract_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.contract_id = $1
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 500`,
      [id],
    );
    return { data: { contract, messages: result.rows } };
  }

  @Post(':id/messages')
  async reply(@Param('id') id: string, @Req() request: Request, @Body() body: { message?: string }) {
    const userId = await this.authenticatedUser(request);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    if (message.length < 1 || message.length > 2000) {
      throw new BadRequestException('Your message must be between 1 and 2,000 characters.');
    }
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT c.id, c.status, c.seller_organization_id,
                (c.buyer_user_id = $2) AS is_buyer,
                EXISTS (SELECT 1 FROM organization_members om
                        WHERE om.organization_id = c.seller_organization_id AND om.user_id = $2) AS is_seller
         FROM marketplace_contracts c WHERE c.id = $1 FOR UPDATE`,
        [id, userId],
      );
      if (!current.rowCount || (!current.rows[0].is_buyer && !current.rows[0].is_seller)) {
        throw new NotFoundException('Contract not found.');
      }
      if (!['proposed', 'accepted'].includes(current.rows[0].status)) {
        throw new ConflictException('This contract is closed for new messages.');
      }
      const inserted = await client.query(
        'INSERT INTO marketplace_contract_messages (contract_id, sender_user_id, message) VALUES ($1,$2,$3) RETURNING id, contract_id, sender_user_id, message, created_at',
        [id, userId, message],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1,$2,'marketplace.contract_message_sent','contract',$3,'{}'::jsonb)",
        [userId, current.rows[0].seller_organization_id, id],
      );
      await client.query('COMMIT');
      const sender = await databasePool!.query('SELECT display_name FROM users WHERE id = $1 LIMIT 1', [userId]);
      return { data: { ...inserted.rows[0], sender_name: sender.rows[0]?.display_name ?? 'TradeMate user' }, message: 'Contract message sent.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}


@Controller('market/trades')
class MarketplaceTradesController {
  @Get('activity')
  async activity(@Query('view') view?: string, @Query('market') market?: string, @Query('limit') limitValue?: string) {
    if (!databasePool) return { source: 'TradeMate marketplace', as_of: new Date().toISOString(), data: [], message: 'Marketplace database is not configured.' };
    if (!view || !['book', 'trades'].includes(view)) throw new BadRequestException('view must be book or trades.');
    const limit = limitValue === undefined ? 100 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100.');
    const category = (market || 'all').toLowerCase();
    if (!['all', 'b2b', 'services', 'p2p'].includes(category)) throw new BadRequestException('market must be all, b2b, services, or p2p.');
    if (view === 'book') {
      const values: unknown[] = [limit];
      const listingFilter = category === 'b2b' ? " AND l.listing_type = 'b2b'" : category === 'services' ? " AND l.listing_type = 'service'" : category === 'p2p' ? ' AND 1=0' : '';
      const p2pFilter = category === 'p2p' || category === 'all' ? '' : ' AND 1=0';
      const result = await databasePool.query(
        `SELECT * FROM (
          SELECT l.id::text AS reference, l.title AS instrument, UPPER(l.listing_type) AS side,
                 l.price_minor_units::text AS price, l.currency_code AS currency,
                 l.quantity_available::text AS quantity, l.created_at AS occurred_at,
                 'TradeMate marketplace'::text AS source, CASE WHEN l.listing_type='service' THEN 'Services' ELSE 'B2B' END AS market
          FROM listings l JOIN organizations o ON o.id=l.seller_organization_id
          WHERE l.status='published' AND o.status='active'${listingFilter}
          UNION ALL
          SELECT b.id::text, b.asset_code || '/' || b.fiat_code, UPPER(b.side),
                 b.price::text, b.fiat_code, b.quantity::text, b.created_at,
                 'TradeMate P2P'::text, 'P2P'::text
          FROM p2p_public_book b WHERE TRUE${p2pFilter}
        ) activity ORDER BY occurred_at DESC LIMIT $1`, values);
      return { view, source: 'TradeMate published listings and open P2P orders', as_of: new Date().toISOString(), data: result.rows };
    }
    const values: unknown[] = [limit];
    const listingFilter = category === 'b2b' ? " AND listing_type='b2b'" : category === 'services' ? " AND listing_type='service'" : category === 'p2p' ? ' AND 1=0' : '';
    const p2pFilter = category === 'p2p' || category === 'all' ? '' : ' AND 1=0';
    const result = await databasePool.query(
      `SELECT * FROM (
        SELECT transaction_reference::text AS reference, listing_title AS instrument, side,
               total_minor_units::text AS price, currency_code AS currency, quantity::text AS quantity,
               completed_at AS occurred_at, 'TradeMate marketplace'::text AS source,
               CASE WHEN listing_type='service' THEN 'Services' ELSE 'B2B' END AS market
        FROM marketplace_public_completed_trades WHERE TRUE${listingFilter}
        UNION ALL
        SELECT trade_reference::text, asset_code || '/' || fiat_code, side,
               fiat_total::text, fiat_code, quantity::text, completed_at,
               'TradeMate P2P'::text, 'P2P'::text
        FROM p2p_public_completed_trades WHERE TRUE${p2pFilter}
      ) activity ORDER BY occurred_at DESC LIMIT $1`, values);
    return { view, source: 'TradeMate confirmed marketplace and completed P2P transactions', as_of: new Date().toISOString(), data: result.rows };
  }

  @Get()
  async completed(@Query('type') type?: string, @Query('currency') currency?: string, @Query('limit') limitValue?: string) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const limit = limitValue === undefined ? 50 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit must be between 1 and 100.');
    if (type && !['b2b', 'service'].includes(type)) throw new BadRequestException('type must be service or b2b.');
    if (currency && !/^[A-Za-z]{3}$/.test(currency)) throw new BadRequestException('currency must be a three-letter code.');
    const values: unknown[] = [];
    const conditions = ['1=1'];
    if (type) { values.push(type); conditions.push(`listing_type = ${values.length}`); }
    if (currency) { values.push(currency.toUpperCase()); conditions.push(`currency_code = ${values.length}`); }
    values.push(limit);
    const result = await databasePool.query(
      `SELECT transaction_reference, listing_id, listing_title, listing_type, quantity,
              unit_price_minor_units, total_minor_units, currency_code, side, completed_at
       FROM marketplace_public_completed_trades
       WHERE ${conditions.join(' AND ')}
       ORDER BY completed_at DESC, transaction_reference, side
       LIMIT ${values.length}`, values,
    );
    return { source: 'TradeMate confirmed marketplace transactions', as_of: new Date().toISOString(), data: result.rows };
  }

}

@Controller('p2p')
class P2PMarketController {
  private filters(asset?: string, fiat?: string, limit?: string) {
    const assetCode = (asset || 'USDT').trim().toUpperCase();
    const fiatCode = (fiat || 'NGN').trim().toUpperCase();
    const pageSize = limit === undefined ? 50 : Number(limit);
    if (!/^[A-Z0-9]{2,16}$/.test(assetCode)) throw new BadRequestException('Invalid asset code.');
    if (!/^[A-Z]{3}$/.test(fiatCode)) throw new BadRequestException('Invalid fiat currency code.');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new BadRequestException('limit must be between 1 and 100.');
    return { assetCode, fiatCode, pageSize };
  }

  @Get('book')
  async book(@Query('asset') asset?: string, @Query('fiat') fiat?: string, @Query('side') side?: string, @Query('limit') limit?: string) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const { assetCode, fiatCode, pageSize } = this.filters(asset, fiat, limit);
    if (side && !['buy', 'sell'].includes(side.toLowerCase())) throw new BadRequestException('side must be buy or sell.');
    const values: unknown[] = [assetCode, fiatCode];
    let sideClause = '';
    if (side) { values.push(side.toLowerCase()); sideClause = ' AND side = $3'; }
    values.push(pageSize);
    const result = await databasePool.query(
      `SELECT id, side, asset_code, fiat_code, price::text, quantity::text,
              min_fiat_amount::text, max_fiat_amount::text, created_at, updated_at
       FROM p2p_public_book WHERE asset_code = $1 AND fiat_code = $2${sideClause}
       ORDER BY CASE WHEN side = 'buy' THEN price END DESC,
                CASE WHEN side = 'sell' THEN price END ASC, created_at DESC
       LIMIT ${values.length}`, values,
    );
    return { source: 'TradeMate P2P orders', as_of: new Date().toISOString(), data: result.rows };
  }

  @Get('trades')
  async trades(@Query('asset') asset?: string, @Query('fiat') fiat?: string, @Query('limit') limit?: string) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const { assetCode, fiatCode, pageSize } = this.filters(asset, fiat, limit);
    const result = await databasePool.query(
      `SELECT trade_reference, side, asset_code, fiat_code, price::text, quantity::text,
              fiat_total::text, completed_at
       FROM p2p_public_completed_trades
       WHERE asset_code = $1 AND fiat_code = $2
       ORDER BY completed_at DESC, trade_reference, side
       LIMIT $3`, [assetCode, fiatCode, pageSize],
    );
    return { source: 'TradeMate completed P2P ledger', as_of: new Date().toISOString(), data: result.rows };
  }
  private async authenticatedUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await databasePool.query("SELECT u.id FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status = 'active' LIMIT 1", [tokenDigest(token)]);
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired.');
    return result.rows[0].id as string;
  }

  @Post('ads')
  async createAd(@Req() request: Request, @Body() body: any) {
    const userId = await this.authenticatedUser(request);
    const side = String(body?.side || '').toLowerCase(), asset = String(body?.asset || '').trim().toUpperCase(), fiat = String(body?.fiat || '').trim().toUpperCase();
    const price = Number(body?.price), quantity = Number(body?.quantity), min = Number(body?.minFiatAmount ?? 0), max = Number(body?.maxFiatAmount ?? price * quantity);
    const methods = Array.isArray(body?.paymentMethods) ? body.paymentMethods.map((v: unknown) => String(v).trim()).filter(Boolean) : [];
    if (!['buy','sell'].includes(side) || !/^[A-Z0-9]{2,16}$/.test(asset) || !/^[A-Z]{3}$/.test(fiat)) throw new BadRequestException('Choose a valid side, asset and fiat currency.');
    if (!(price > 0) || !(quantity > 0) || !Number.isFinite(price * quantity) || min < 0 || max < min || max <= 0 || max > price * quantity + 0.01) throw new BadRequestException('Enter valid price, quantity and fiat limits.');
    if (methods.length > 10 || methods.some((v: string) => v.length > 60)) throw new BadRequestException('Invalid payment methods.');
    const result = await databasePool!.query('INSERT INTO p2p_orders (user_id,side,asset_code,fiat_code,price,quantity,remaining_quantity,min_fiat_amount,max_fiat_amount,payment_methods) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9::jsonb) RETURNING id,side,asset_code,fiat_code,price::text,quantity::text,remaining_quantity::text,min_fiat_amount::text,max_fiat_amount::text,payment_methods,status,created_at', [userId,side,asset,fiat,String(price),String(quantity),String(min),String(max),JSON.stringify(methods)]);
    return { ad: result.rows[0] };
  }

  @Get('my-ads')
  async myAds(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query('SELECT id,side,asset_code,fiat_code,price::text,quantity::text,remaining_quantity::text,min_fiat_amount::text,max_fiat_amount::text,payment_methods,status,created_at,updated_at FROM p2p_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
    return { data: result.rows };
  }

  @Delete('ads/:id')
  async cancelAd(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query("UPDATE p2p_orders SET status='cancelled',updated_at=now() WHERE id=$1 AND user_id=$2 AND status IN ('open','partially_filled') RETURNING id",[id,userId]);
    if (!result.rowCount) throw new NotFoundException('Open advertisement not found.');
    return { message: 'Advertisement cancelled.' };
  }

  @Post('orders')
  async placeOrder(@Req() request: Request, @Body() body: any) {
    const userId = await this.authenticatedUser(request), adId = String(body?.adId || ''), fiatAmount = Number(body?.fiatAmount);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(adId) || !(fiatAmount > 0) || !Number.isFinite(fiatAmount)) throw new BadRequestException('Choose an offer and enter a valid fiat amount.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query('SELECT id,user_id,side,asset_code,fiat_code,price,remaining_quantity,min_fiat_amount,max_fiat_amount,status FROM p2p_orders WHERE id=$1 FOR UPDATE',[adId]);
      if (!locked.rowCount) throw new NotFoundException('Advertisement not found.');
      const ad = locked.rows[0];
      if (ad.user_id === userId) throw new BadRequestException('You cannot order from your own advertisement.');
      if (!['open','partially_filled'].includes(ad.status)) throw new ConflictException('Advertisement is no longer available.');
      if (fiatAmount < Number(ad.min_fiat_amount) || fiatAmount > Number(ad.max_fiat_amount)) throw new BadRequestException('Amount is outside the advertisement limits.');
      const qty = fiatAmount / Number(ad.price);
      if (qty <= 0 || qty > Number(ad.remaining_quantity)) throw new ConflictException('Insufficient quantity remains.');
      const buyer = ad.side === 'sell' ? userId : ad.user_id, seller = ad.side === 'sell' ? ad.user_id : userId;
      const trade = await client.query("INSERT INTO p2p_trades (order_id,buyer_user_id,seller_user_id,asset_code,fiat_code,price,quantity,fiat_total,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING id,order_id,asset_code,fiat_code,price::text,quantity::text,fiat_total::text,status,created_at",[adId,buyer,seller,ad.asset_code,ad.fiat_code,ad.price,qty.toFixed(12),fiatAmount.toFixed(2)]);
      const remaining = Math.max(0,Number(ad.remaining_quantity)-qty);
      await client.query("UPDATE p2p_orders SET remaining_quantity=$1,status=CASE WHEN $1<=0 THEN 'filled' ELSE 'partially_filled' END,updated_at=now() WHERE id=$2",[remaining.toFixed(12),adId]);
      await client.query('COMMIT');
      return { order: trade.rows[0], message: 'Order created. TradeMate does not hold funds or provide escrow.' };
    } catch (error) { await client.query('ROLLBACK').catch(()=>undefined); throw error; } finally { client.release(); }
  }

  @Get('my-orders')
  async myOrders(@Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query('SELECT id,order_id,buyer_user_id,seller_user_id,asset_code,fiat_code,price::text,quantity::text,fiat_total::text,status,buyer_payment_sent_at,seller_payment_confirmed_at,payment_reference,dispute_reason,created_at,updated_at FROM p2p_trades WHERE buyer_user_id=$1 OR seller_user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
    return { data: result.rows };
  }

  @Post('orders/:id/payment-sent')
  async paymentSent(@Param('id') id: string, @Req() request: Request, @Body() body: any) {
    const userId = await this.authenticatedUser(request), ref = typeof body?.reference === 'string' ? body.reference.trim() : '';
    if (ref.length > 160) throw new BadRequestException('Reference is too long.');
    const result = await databasePool!.query("UPDATE p2p_trades SET buyer_payment_sent_at=now(),payment_reference=NULLIF($1,''),updated_at=now() WHERE id=$2 AND buyer_user_id=$3 AND status='pending' AND buyer_payment_sent_at IS NULL RETURNING id,status,buyer_payment_sent_at",[ref,id,userId]);
    if (!result.rowCount) throw new ConflictException('Order cannot be marked as paid.');
    return { order: result.rows[0], message: 'Seller confirmation is still required.' };
  }

  @Post('orders/:id/confirm-receipt')
  async confirmReceipt(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    const result = await databasePool!.query("UPDATE p2p_trades SET seller_payment_confirmed_at=now(),status='completed',completed_at=now(),updated_at=now() WHERE id=$1 AND seller_user_id=$2 AND status='pending' AND buyer_payment_sent_at IS NOT NULL AND seller_payment_confirmed_at IS NULL RETURNING id,status,completed_at",[id,userId]);
    if (!result.rowCount) throw new ConflictException('Buyer must first mark payment sent; order must still be pending.');
    return { order: result.rows[0] };
  }

  @Post('orders/:id/cancel')
  async cancelOrder(@Param('id') id: string, @Req() request: Request) {
    const userId = await this.authenticatedUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid order UUID.');
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query("SELECT id,order_id,buyer_user_id,status,buyer_payment_sent_at,quantity::text FROM p2p_trades WHERE id=$1 FOR UPDATE",[id]);
      if (!locked.rowCount) throw new NotFoundException('P2P order not found.');
      const trade = locked.rows[0];
      if (trade.buyer_user_id !== userId) throw new ForbiddenException('Only the buyer can cancel this unpaid order.');
      if (trade.status !== 'pending' || trade.buyer_payment_sent_at) throw new ConflictException('An order cannot be cancelled after payment is marked sent or a dispute is opened.');
      const ad = await client.query('SELECT id,quantity::numeric AS quantity,remaining_quantity::numeric AS remaining_quantity,status FROM p2p_orders WHERE id=$1 FOR UPDATE',[trade.order_id]);
      if (!ad.rowCount) throw new NotFoundException('Original advertisement not found.');
      const restored = Number(ad.rows[0].remaining_quantity) + Number(trade.quantity);
      const total = Number(ad.rows[0].quantity);
      if (!Number.isFinite(restored) || restored > total + 1e-9) throw new ConflictException('Reserved quantity could not be safely restored.');
      await client.query("UPDATE p2p_orders SET remaining_quantity=$1,status=CASE WHEN status IN ('cancelled','expired') THEN status WHEN $1 >= quantity THEN 'open' ELSE 'partially_filled' END,updated_at=now() WHERE id=$2",[restored.toFixed(12),trade.order_id]);
      const cancelled = await client.query("UPDATE p2p_trades SET status='cancelled',cancelled_by=$1,updated_at=now() WHERE id=$2 AND status='pending' AND buyer_payment_sent_at IS NULL RETURNING id,status,updated_at",[userId,id]);
      if (!cancelled.rowCount) throw new ConflictException('Order state changed; refresh and try again.');
      await client.query('COMMIT');
      return { order: cancelled.rows[0], message: 'Order cancelled. The reserved advertisement quantity was restored where the offer remains active.' };
    } catch (error) { await client.query('ROLLBACK').catch(()=>undefined); throw error; }
    finally { client.release(); }
  }

  @Post('orders/:id/dispute')
  async dispute(@Param('id') id: string, @Req() request: Request, @Body() body: any) {
    const userId = await this.authenticatedUser(request), reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid order UUID.');
    if (reason.length < 5 || reason.length > 1000) throw new BadRequestException('Dispute reason must be 5 to 1,000 characters.');
    const result = await databasePool!.query("UPDATE p2p_trades SET status='disputed',dispute_reason=$1,updated_at=now() WHERE id=$2 AND (buyer_user_id=$3 OR seller_user_id=$3) AND status='pending' AND buyer_payment_sent_at IS NOT NULL RETURNING id,status,dispute_reason",[reason,id,userId]);
    if (!result.rowCount) throw new ConflictException('A dispute can only be opened by a participant after the buyer marks payment sent.');
    return { order: result.rows[0] };
  }
}

const reviewerKeyId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 12);

@Controller('feed')
class CommunityFeedController {
  private async currentUser(request: Request): Promise<string> {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const token = sessionTokenFrom(request);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const result = await databasePool.query(
      "SELECT u.id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
      [tokenDigest(token)],
    );
    if (!result.rowCount) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return result.rows[0].id as string;
  }

  private reviewKey(request: Request): string {
    const expected = process.env.TRADEMATE_REVIEW_API_KEY || '';
    const supplied = request.header('x-review-key') || '';
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Feed moderation access is not authorized.');
    }
    return reviewerKeyId(expected);
  }

  @Get('posts')
  async posts(@Query('type') type?: string, @Query('limit') rawLimit?: string) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const normalized = type === 'Posts' || type === 'post' ? 'post'
      : type === 'Feedback' || type === 'feedback' ? 'feedback'
      : type === 'Announcements' || type === 'announcement' ? 'announcement' : null;
    const limit = Math.min(50, Math.max(1, Number.parseInt(rawLimit || '30', 10) || 30));
    const result = await databasePool.query(
      `SELECT p.id, p.post_type, p.title, p.body, p.pinned, p.created_at,
              COALESCE(u.display_name, 'TradeMate Team') AS author_name,
              (SELECT count(*)::int FROM feed_comments c WHERE c.post_id = p.id AND c.status = 'published') AS comment_count,
              COALESCE((SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'content_type', a.content_type, 'byte_size', a.byte_size) ORDER BY a.created_at)
                        FROM feed_attachments a WHERE a.post_id = p.id), '[]'::json) AS attachments
       FROM feed_posts p LEFT JOIN users u ON u.id = p.author_user_id
       WHERE p.status = 'published' AND ($1::text IS NULL OR p.post_type = $1)
       ORDER BY p.pinned DESC, p.created_at DESC LIMIT $2`,
      [normalized, limit],
    );
    return { posts: result.rows };
  }

  @Post('posts')
  async createPost(@Req() request: Request, @Body() body: { type?: string; title?: string; body?: string; attachments?: Array<{ name?: string; type?: string; data?: string }> }) {
    const userId = await this.currentUser(request);
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (title.length < 1 || title.length > 140) throw new BadRequestException('Post titles must be between 1 and 140 characters.');
    if (content.length < 1 || content.length > 5000) throw new BadRequestException('Posts must be between 1 and 5,000 characters.');
    const type = body?.type === 'feedback' ? 'feedback' : body?.type === 'post' ? 'post' : null;
    if (!type) throw new BadRequestException('Choose post or feedback. Announcements are published by moderators.');
    const files = Array.isArray(body?.attachments) ? body.attachments : [];
    if (files.length > 4) throw new BadRequestException('Attach up to 4 files per post.');
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav']);
    const prepared = files.map((file) => {
      const name = typeof file?.name === 'string' ? file.name.trim().slice(0, 180) : '';
      const mime = typeof file?.type === 'string' ? file.type.toLowerCase() : '';
      const encoded = typeof file?.data === 'string' ? file.data.replace(/^data:[^,]*;base64,/, '') : '';
      if (!name || !allowed.has(mime) || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new BadRequestException('One of the attachments is invalid or unsupported.');
      const bytes = Buffer.from(encoded, 'base64');
      if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new BadRequestException('Each attachment must be 5 MB or smaller.');
      return { name, mime, bytes };
    });
    const client = await databasePool!.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO feed_posts (author_user_id, post_type, title, body) VALUES ($1, $2, $3, $4)
         RETURNING id, post_type, title, body, pinned, created_at`,
        [userId, type, title, content],
      );
      for (const file of prepared) await client.query(
        'INSERT INTO feed_attachments (post_id, file_name, content_type, byte_size, content) VALUES ($1, $2, $3, $4, $5)',
        [result.rows[0].id, file.name, file.mime, file.bytes.length, file.bytes],
      );
      await client.query(
        "INSERT INTO audit_events (actor_user_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'feed.post.created', 'feed_post', $2, $3::jsonb)",
        [userId, result.rows[0].id, JSON.stringify({ post_type: type, attachment_count: prepared.length })],
      );
      await client.query('COMMIT');
      return { post: { ...result.rows[0], author_name: 'You', comment_count: 0, attachments: prepared.map((f) => ({ file_name: f.name, content_type: f.mime, byte_size: f.bytes.length })) } };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('posts/:id/attachments/:attachmentId')
  async attachment(@Param('id') id: string, @Param('attachmentId') attachmentId: string, @Res() response: Response) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || !uuid.test(attachmentId)) throw new BadRequestException('Invalid attachment id.');
    const result = await databasePool!.query(
      `SELECT a.file_name, a.content_type, a.content, a.byte_size
       FROM feed_attachments a JOIN feed_posts p ON p.id = a.post_id
       WHERE a.id = $1 AND a.post_id = $2 AND p.status = 'published' LIMIT 1`,
      [attachmentId, id],
    );
    if (!result.rowCount) throw new NotFoundException('Attachment not found.');
    const file = result.rows[0];
    response.setHeader('Content-Type', file.content_type);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Length', String(file.byte_size));
    response.setHeader('Content-Disposition', 'inline; filename="' + String(file.file_name).replace(/[\\"\\r\\n]/g, '_') + '"');
    response.setHeader('Cache-Control', 'public, max-age=3600');
    response.send(file.content);
  }

  @Get('posts/:id/comments')
  async comments(@Param('id') id: string) {
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid post id.');
    const result = await databasePool.query(
      `SELECT c.id, c.body, c.created_at, u.display_name AS author_name
       FROM feed_comments c JOIN users u ON u.id = c.author_user_id
       JOIN feed_posts p ON p.id = c.post_id
       WHERE c.post_id = $1 AND c.status = 'published' AND p.status = 'published'
       ORDER BY c.created_at ASC LIMIT 200`,
      [id],
    );
    return { comments: result.rows };
  }

  @Post('posts/:id/comments')
  async addComment(@Param('id') id: string, @Req() request: Request, @Body() body: { body?: string }) {
    const userId = await this.currentUser(request);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid post id.');
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (content.length < 1 || content.length > 2000) throw new BadRequestException('Comments must be between 1 and 2,000 characters.');
    const result = await databasePool!.query(
      `INSERT INTO feed_comments (post_id, author_user_id, body)
       SELECT p.id, $2, $3 FROM feed_posts p WHERE p.id = $1 AND p.status = 'published'
       RETURNING id, post_id, body, created_at`,
      [id, userId, content],
    );
    if (!result.rowCount) throw new NotFoundException('Published post not found.');
    return { comment: { ...result.rows[0], author_name: 'You' } };
  }

  @Post('reports')
  async report(@Req() request: Request, @Body() body: { postId?: string; commentId?: string; reason?: string }) {
    const userId = await this.currentUser(request);
    const postId = typeof body?.postId === 'string' ? body.postId : null;
    const commentId = typeof body?.commentId === 'string' ? body.commentId : null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!!postId === !!commentId || (postId && !uuid.test(postId)) || (commentId && !uuid.test(commentId))) throw new BadRequestException('Report exactly one valid post or comment.');
    if (reason.length < 3 || reason.length > 1000) throw new BadRequestException('Explain the report in 3 to 1,000 characters.');
    const result = await databasePool!.query(
      `INSERT INTO feed_reports (reporter_user_id, post_id, comment_id, reason)
       VALUES ($1, $2, $3, $4) RETURNING id, status, created_at`,
      [userId, postId, commentId, reason],
    );
    return { report: result.rows[0] };
  }

  @Get('moderation/reports')
  async reportQueue(@Req() request: Request) {
    this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT r.id, r.reason, r.status, r.created_at, r.post_id, r.comment_id,
              reporter.display_name AS reporter_name, p.body AS post_body, c.body AS comment_body
       FROM feed_reports r JOIN users reporter ON reporter.id = r.reporter_user_id
       LEFT JOIN feed_posts p ON p.id = r.post_id LEFT JOIN feed_comments c ON c.id = r.comment_id
       WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100`,
    );
    return { reports: result.rows };
  }

  @Patch('moderation/reports/:id')
  async reviewReport(@Param('id') id: string, @Req() request: Request, @Body() body: { action?: string }) {
    const keyId = this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('Invalid report id.');
    if (!['hide', 'dismiss'].includes(body?.action || '')) throw new BadRequestException('Choose hide or dismiss.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query("SELECT * FROM feed_reports WHERE id = $1 AND status = 'open' FOR UPDATE", [id]);
      if (!found.rowCount) throw new NotFoundException('Open report not found.');
      const report = found.rows[0];
      if (body.action === 'hide') {
        if (report.post_id) await client.query("UPDATE feed_posts SET status = 'hidden', updated_at = now() WHERE id = $1", [report.post_id]);
        if (report.comment_id) await client.query("UPDATE feed_comments SET status = 'hidden' WHERE id = $1", [report.comment_id]);
      }
      await client.query("UPDATE feed_reports SET status = $1, reviewed_by = $2, reviewed_at = now() WHERE id = $3", [body.action === 'hide' ? 'reviewed' : 'dismissed', keyId, id]);
      await client.query(
        "INSERT INTO audit_events (event_type, entity_type, entity_id, metadata) VALUES ('feed.report.reviewed', 'feed_report', $1, $2::jsonb)",
        [id, JSON.stringify({ action: body.action, reviewer_key_id: keyId })],
      );
      await client.query('COMMIT');
      return { success: true, message: body.action === 'hide' ? 'Reported content hidden.' : 'Report dismissed.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Post('announcements')
  async announce(@Req() request: Request, @Body() body: { body?: string }) {
    const keyId = this.reviewKey(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const content = typeof body?.body === 'string' ? body.body.trim() : '';
    if (content.length < 1 || content.length > 5000) throw new BadRequestException('Announcements must be between 1 and 5,000 characters.');
    const result = await databasePool.query(
      `INSERT INTO feed_posts (author_user_id, post_type, body, pinned)
       VALUES (NULL, 'announcement', $1, true)
       RETURNING id, post_type, body, pinned, created_at`,
      [content],
    );
    
    await databasePool.query(
      "INSERT INTO audit_events (event_type, entity_type, entity_id, metadata) VALUES ('feed.announcement.created', 'feed_post', $1, $2::jsonb)",
      [result.rows[0].id, JSON.stringify({ reviewer_key_id: keyId })],
    );
    return { announcement: result.rows[0] };
  }
}

@Controller('moderation')
class ModerationController {
  private authorize(request: Request) {
    const expected = process.env.TRADEMATE_REVIEW_API_KEY || '';
    const supplied = request.header('x-review-key') || '';
    const expectedBytes = Buffer.from(expected);
    const suppliedBytes = Buffer.from(supplied);
    if (!expected || expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      throw new UnauthorizedException('Moderation access is not authorized.');
    }
    return reviewerKeyId(expected);
  }

  @Get('organizations')
  async organizationQueue(@Req() request: Request) {
    this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT o.id, o.name, o.organization_type, o.country_code, o.default_currency, o.status, o.created_at,
              u.email AS owner_email, u.display_name AS owner_name
       FROM organizations o
       JOIN organization_members om ON om.organization_id = o.id AND om.member_role = 'owner'
       JOIN users u ON u.id = om.user_id
       WHERE o.status = 'pending'
       ORDER BY o.created_at ASC LIMIT 100`,
    );
    return { data: result.rows };
  }

  @Post('organizations/:id/review')
  async reviewOrganization(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string; note?: string },
  ) {
    const keyId = this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid organization UUID.');
    if (!['approved', 'rejected'].includes(body?.decision || '')) throw new BadRequestException('decision must be approved or rejected.');
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > 1000) throw new BadRequestException('Review note must be 1,000 characters or fewer.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        "UPDATE organizations SET status = $1, updated_at = now() WHERE id = $2 AND status = 'pending' RETURNING id, name, status",
        [body.decision === 'approved' ? 'active' : 'suspended', id],
      );
      if (!updated.rowCount) {
        const exists = await client.query('SELECT status FROM organizations WHERE id = $1', [id]);
        if (!exists.rowCount) throw new NotFoundException('Organization not found.');
        throw new ConflictException('Only pending organizations can be reviewed.');
      }
      await client.query(
        'INSERT INTO organization_reviews (organization_id, decision, note, reviewer_key_id) VALUES ($1, $2, $3, $4)',
        [id, body.decision, note, keyId],
      );
      await client.query(
        "INSERT INTO audit_events (organization_id, event_type, entity_type, entity_id, metadata) VALUES ($1, 'organization.reviewed', 'organization', $1, $2::jsonb)",
        [id, JSON.stringify({ decision: body.decision, note })],
      );
      await client.query('COMMIT');
      return { organization: updated.rows[0], message: body.decision === 'approved' ? 'Organization approved.' : 'Organization rejected and suspended.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }

  @Get('listings')
  async listingQueue(@Req() request: Request) {
    this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    const result = await databasePool.query(
      `SELECT l.id, l.title, l.description, l.listing_type, l.price_minor_units::text AS price_minor_units,
              l.currency_code, l.country_code, l.quantity_available, l.review_submitted_at,
              o.id AS organization_id, o.name AS seller_name, o.status AS organization_status
       FROM listings l JOIN organizations o ON o.id = l.seller_organization_id
       WHERE l.status = 'pending_review'
       ORDER BY l.review_submitted_at ASC NULLS LAST LIMIT 100`,
    );
    return { data: result.rows };
  }

  @Post('listings/:id/review')
  async reviewListing(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: { decision?: string; note?: string },
  ) {
    const keyId = this.authorize(request);
    if (!databasePool) throw new UnauthorizedException('TradeMate is temporarily unavailable.');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('id must be a valid listing UUID.');
    if (!['approved', 'rejected'].includes(body?.decision || '')) throw new BadRequestException('decision must be approved or rejected.');
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    if (note.length > 1000) throw new BadRequestException('Review note must be 1,000 characters or fewer.');
    const client = await databasePool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE listings l
         SET status = CASE WHEN $1 = 'approved' THEN 'published' ELSE 'rejected' END,
             reviewed_at = now(), review_note = $2, updated_at = now()
         WHERE l.id = $3 AND l.status = 'pending_review'
           AND ($1 <> 'approved' OR EXISTS (SELECT 1 FROM organizations o WHERE o.id = l.seller_organization_id AND o.status = 'active'))
         RETURNING l.id, l.title, l.status, l.reviewed_at, l.review_note`,
        [body.decision, note, id],
      );
      if (!result.rowCount) {
        const existing = await client.query(
          "SELECT l.status, o.status AS organization_status FROM listings l JOIN organizations o ON o.id = l.seller_organization_id WHERE l.id = $1",
          [id],
        );
        if (!existing.rowCount) throw new NotFoundException('Offer not found.');
        if (existing.rows[0].status !== 'pending_review') throw new ConflictException('Only offers pending review can be reviewed.');
        throw new ConflictException('Approve the seller organization before approving its offers.');
      }
      await client.query(
        "INSERT INTO audit_events (organization_id, event_type, entity_type, entity_id, metadata) SELECT l.seller_organization_id, 'listing.reviewed', 'listing', l.id, $2::jsonb FROM listings l WHERE l.id = $1",
        [id, JSON.stringify({ decision: body.decision, note, reviewer_key_id: keyId })],
      );
      await client.query('COMMIT');
      return { listing: result.rows[0], message: body.decision === 'approved' ? 'Offer approved and published.' : 'Offer rejected.' };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
}


const MARKET_SYMBOLS = new Set([
  '^GSPC','^DJI','^IXIC','^FTSE','^GDAXI','^FCHI','^N225','^HSI','^STOXX50E','^NSEI',
  'GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','ZW=F','ZC=F','ZS=F','KC=F',
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','BRK-B','JPM','AVGO',
  '^IRX','^FVX','^TNX','^TYX','TLT','IEF','SHY','GOVT','TIP','VGIT',
]);
const marketQuoteCache = new Map<string, { expiresAt: number; value: any }>();

@Controller('market')
class PublicMarketQuotesController {
  @Get('quotes')
  async quotes(@Query('symbols') raw: string) {
    const requested = [...new Set(String(raw || '').split(',').map((s) => s.trim()).filter(Boolean))];
    if (!requested.length || requested.length > 10 || requested.some((symbol) => !MARKET_SYMBOLS.has(symbol))) {
      throw new BadRequestException('Request up to 10 supported market symbols.');
    }
    const now = Date.now();
    const results = await Promise.all(requested.map(async (symbol) => {
      const cached = marketQuoteCache.get(symbol);
      if (cached && cached.expiresAt > now) return cached.value;
      try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?range=1d&interval=1m';
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 TradeMateMarketData/1.0' },
          signal: AbortSignal.timeout(7000),
        });
        if (!response.ok) throw new Error('Upstream quote unavailable');
        const payload: any = await response.json();
        const result = payload?.chart?.result?.[0];
        const meta = result?.meta;
        const price = Number(meta?.regularMarketPrice);
        const previous = Number(meta?.chartPreviousClose ?? meta?.previousClose);
        const timestamp = Number(meta?.regularMarketTime) * 1000;
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
          throw new Error('Upstream returned no current quote');
        }
        const value = {
          symbol, price, previousClose: Number.isFinite(previous) && previous > 0 ? previous : null,
          changePercent: Number.isFinite(previous) && previous > 0 ? ((price - previous) / previous) * 100 : null,
          currency: typeof meta.currency === 'string' ? meta.currency : null,
          marketTime: new Date(timestamp).toISOString(),
          exchange: typeof meta.fullExchangeName === 'string' ? meta.fullExchangeName : null,
          status: Date.now() - timestamp < 15 * 60 * 1000 ? 'live' : 'delayed',
        };
        marketQuoteCache.set(symbol, { expiresAt: Date.now() + 30000, value });
        return value;
      } catch {
        return { symbol, status: 'unavailable', price: null, previousClose: null, changePercent: null, currency: null, marketTime: null, exchange: null };
      }
    }));
    return { quotes: results, source: 'Yahoo Finance chart data', fetchedAt: new Date().toISOString() };
  }
}

@Module({ controllers: [PublicMarketQuotesController, CommunityFeedController, HealthController, AuthController, OrganizationsController, PublicListingsController, MarketplaceTradesController, P2PMarketController, EnquiriesController, MarketplaceContractsController, ModerationController] })
export class AppModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (databasePool) await databasePool.end();
  }
}
