import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, HttpException, HttpStatus, Module, NotFoundException, OnModuleDestroy, Param, Post, Patch, Delete, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
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
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
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
    response.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax', path: '/' });
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
    if (!['product', 'service'].includes(listingType || '')) throw new BadRequestException('Choose product or service.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (!/^\d{1,12}$/.test(quantityText) || !Number.isSafeInteger(Number(quantityText))) throw new BadRequestException('Quantity must be a whole number, or leave it blank for services.');
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
    if (!['product', 'service'].includes(listingType || '')) throw new BadRequestException('Choose product or service.');
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(priceText)) throw new BadRequestException('Enter a valid price with up to two decimal places.');
    const priceMinorUnits = Math.round(Number(priceText) * 100);
    if (!Number.isSafeInteger(priceMinorUnits) || priceMinorUnits < 0) throw new BadRequestException('Enter a valid non-negative price.');
    let quantity: number | null = null;
    if (quantityText !== null) {
      if (listingType === 'service') throw new BadRequestException('Services cannot have a product quantity.');
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
    if (type && !['product', 'service'].includes(type)) {
      throw new BadRequestException('type must be product or service.');
    }
    if (country && !/^[A-Za-z]{2}$/.test(country)) {
      throw new BadRequestException('country must be a two-letter country code.');
    }
    if (category && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(category)) {
      throw new BadRequestException('category must be a valid category UUID.');
    }

    const conditions = ["l.status = 'published'", "o.status = 'active'"];
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


const reviewerKeyId = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 12);

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

@Module({ controllers: [HealthController, AuthController, OrganizationsController, PublicListingsController, EnquiriesController, ModerationController] })
export class AppModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (databasePool) await databasePool.end();
  }
}
