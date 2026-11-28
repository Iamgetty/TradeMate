import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import type { IncomingMessage, Server } from 'node:http';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { createRlsAwarePool } from './database-context';
import { WebSocket, WebSocketServer } from 'ws';
import type { Request } from 'express';

const pool = process.env.DATABASE_URL
  ? createRlsAwarePool(new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === 'require' ? true : undefined,
      connectionTimeoutMillis: 5000,
      max: 4,
    }))
  : null;

type VerificationCaseType = 'kyc' | 'kyb';
type SocketClient = { userId: string; socket: WebSocket };
const sockets = new Set<SocketClient>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sessionTokenFromRequest = (request: Request | IncomingMessage): string => {
  const cookieHeader = request.headers.cookie || '';
  const cookie = cookieHeader.split(';').map((part) => part.trim())
    .find((part) => part.startsWith('trademate_session='));
  if (!cookie) return '';
  try { return decodeURIComponent(cookie.slice('trademate_session='.length)); } catch { return ''; }
};

const digestSession = (token: string) => createHash('sha256').update(token).digest('hex');

const resolveUser = async (token: string): Promise<string> => {
  if (!pool || !token) throw new HttpException('Please sign in.', HttpStatus.UNAUTHORIZED);
  const result = await pool.query<{ id: string }>(
    'SELECT resolved_user_id::text AS id FROM trademate_private.resolve_presented_session($1)',
    [digestSession(token)],
  );
  if (!result.rowCount) throw new HttpException('Your session has expired. Please sign in again.', HttpStatus.UNAUTHORIZED);
  return result.rows[0].id;
};

const requirePool = () => {
  if (!pool) throw new HttpException('Verification service is temporarily unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
  return pool;
};

const emitUserEvent = (userId: string, event: Record<string, unknown>) => {
  const message = JSON.stringify({ type: 'verification.event', data: event });
  for (const client of sockets) {
    if (client.userId !== userId || client.socket.readyState !== WebSocket.OPEN) continue;
    if (client.socket.bufferedAmount > 262144) {
      client.socket.close(1013, 'Verification event consumer is too slow.');
      sockets.delete(client);
      continue;
    }
    client.socket.send(message);
  }
};

const CASE_CHECKS: Record<VerificationCaseType, string[]> = {
  kyc: ['identity', 'document_authenticity', 'liveness'],
  kyb: ['registry', 'ownership', 'representative_authority'],
};

@Controller('verification')
export class VerificationController {
  @Get('countries')
  async countries() {
    const db = requirePool();
    const result = await db.query(
      `SELECT country_code, policy_version, policy_status, supported_case_types,
              configuration, effective_at, reviewed_at
       FROM public.verification_country_policies ORDER BY country_code`,
    );
    return {
      countries: result.rows.map((row) => ({
        ...row,
        available: row.policy_status === 'active',
        automated_decisions: row.policy_status === 'active' && row.configuration?.automated_decisions === true,
      })),
    };
  }

  @Get('me')
  async mine(@Req() request: Request) {
    const db = requirePool();
    const userId = await resolveUser(sessionTokenFromRequest(request));
    const result = await db.query(
      `SELECT c.id, c.case_type, c.subject_user_id, c.subject_organization_id,
              c.country_code, c.entity_type, c.status, c.risk_tier, c.policy_version,
              c.created_at, c.updated_at, c.submitted_at, c.decided_at, c.expires_at,
              COALESCE(json_agg(json_build_object(
                'id', k.id, 'type', k.check_type, 'status', k.status,
                'resultCode', k.result_code, 'resultSummary', k.result_summary,
                'checkedAt', k.checked_at
              ) ORDER BY k.created_at) FILTER (WHERE k.id IS NOT NULL), '[]'::json) AS checks
       FROM public.verification_cases c
       LEFT JOIN public.verification_checks k ON k.case_id = c.id
       WHERE c.subject_user_id = $1
          OR (c.subject_organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members m
            WHERE m.organization_id = c.subject_organization_id AND m.user_id = $1
          ))
       GROUP BY c.id
       ORDER BY c.created_at DESC LIMIT 100`,
      [userId],
    );
    return { cases: result.rows };
  }

  @Post('cases')
  @HttpCode(201)
  async createCase(@Req() request: Request, @Body() body: unknown) {
    const db = requirePool();
    const userId = await resolveUser(sessionTokenFromRequest(request));
    if (!isRecord(body)) throw new BadRequestException('A verification case payload is required.');
    const caseType = body.caseType;
    if (caseType !== 'kyc' && caseType !== 'kyb') throw new BadRequestException('caseType must be kyc or kyb.');
    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(countryCode)) throw new BadRequestException('A valid two-letter countryCode is required.');
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : null;
    if (idempotencyKey !== null && (idempotencyKey.length < 8 || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey))) {
      throw new BadRequestException('idempotencyKey must contain 8-128 safe characters.');
    }
    const policy = await db.query(
      'SELECT policy_version, policy_status, supported_case_types FROM public.verification_country_policies WHERE country_code = $1',
      [countryCode],
    );
    if (!policy.rowCount || !policy.rows[0].supported_case_types.includes(caseType)) {
      throw new HttpException('Verification is not configured for this country and case type.', HttpStatus.NOT_FOUND);
    }
    if (policy.rows[0].policy_status !== 'active') {
      throw new HttpException('This country verification policy is not yet enabled for submissions.', HttpStatus.SERVICE_UNAVAILABLE);
    }

    let organizationId: string | null = null;
    let entityType: string | null = null;
    if (caseType === 'kyb') {
      organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
        throw new BadRequestException('A valid organizationId is required for KYB.');
      }
      const membership = await db.query(
        `SELECT o.country_code, o.organization_type
         FROM public.organizations o
         JOIN public.organization_members m ON m.organization_id = o.id
         WHERE o.id = $1 AND m.user_id = $2 AND m.member_role IN ('owner','admin')
         LIMIT 1`,
        [organizationId, userId],
      );
      if (!membership.rowCount) throw new HttpException('You must be an organization owner or admin to start KYB.', HttpStatus.FORBIDDEN);
      if (membership.rows[0].country_code !== countryCode) throw new BadRequestException('The verification country must match the organization country.');
      entityType = typeof body.entityType === 'string' ? body.entityType.trim().slice(0, 80) : membership.rows[0].organization_type;
    } else if (body.organizationId !== undefined) {
      throw new BadRequestException('KYC cases belong to an individual user, not an organization.');
    }

    const client = await db.connect();
    let caseRow: Record<string, unknown>;
    let reused = false;
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO public.verification_cases
          (case_type, subject_user_id, subject_organization_id, created_by_user_id,
           country_code, entity_type, policy_version, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (created_by_user_id, idempotency_key)
           WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id, case_type, subject_user_id, subject_organization_id,
                   country_code, entity_type, status, risk_tier, policy_version,
                   created_at, updated_at`,
        [caseType, caseType === 'kyc' ? userId : null, organizationId, userId,
          countryCode, entityType, policy.rows[0].policy_version, idempotencyKey],
      );
      if (!inserted.rowCount && idempotencyKey) {
        const existing = await client.query(
          `SELECT id, case_type, subject_user_id, subject_organization_id,
                  country_code, entity_type, status, risk_tier, policy_version,
                  created_at, updated_at
           FROM public.verification_cases WHERE created_by_user_id = $1 AND idempotency_key = $2`,
          [userId, idempotencyKey],
        );
        caseRow = existing.rows[0];
        reused = true;
      } else if (!inserted.rowCount) {
        throw new HttpException('Unable to create verification case.', HttpStatus.CONFLICT);
      } else {
        caseRow = inserted.rows[0];
        for (const checkType of CASE_CHECKS[caseType]) {
          await client.query(
            'INSERT INTO public.verification_checks (case_id, check_type) VALUES ($1,$2) ON CONFLICT (case_id, check_type) DO NOTHING',
            [caseRow.id, checkType],
          );
        }
        await client.query(
          `INSERT INTO public.verification_events (case_id, actor_user_id, event_type, metadata)
           VALUES ($1,$2,'verification.case_created',$3::jsonb)`,
          [caseRow.id, userId, JSON.stringify({ caseType, countryCode, policyVersion: policy.rows[0].policy_version })],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    emitUserEvent(userId, { event: 'verification.case_created', case: caseRow });
    return { case: caseRow, checks: CASE_CHECKS[caseType], reused };
  }
}

export function attachVerificationSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  const allowedOrigins = new Set(
    (process.env.WEB_ORIGIN || '').split(',').map((value) => {
      try { return new URL(value.trim()).origin; } catch { return ''; }
    }).filter(Boolean).concat(['http://localhost:3000']),
  );
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount > 262144) {
        client.close(1013, 'Verification socket is too slow.');
      }
    }
  }, 30000);
  heartbeat.unref?.();

  server.on('upgrade', (request, socket, head) => {
    const pathname = (() => {
      try { return new URL(request.url || '/', 'http://localhost').pathname; } catch { return ''; }
    })();
    if (pathname !== '/api/verification/socket') return;
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n');
      socket.destroy();
      return;
    }
    void (async () => {
      try {
        const userId = await resolveUser(sessionTokenFromRequest(request));
        wss.handleUpgrade(request, socket, head, (client) => {
          const record = { userId, socket: client };
          sockets.add(record);
          client.send(JSON.stringify({
            type: 'verification.connected',
            data: { authenticated: true, userId },
          }));
          client.on('close', () => sockets.delete(record));
          client.on('error', () => sockets.delete(record));
          client.on('message', (raw) => {
            // This socket is server-push only. Client messages are ignored.
            if (raw.length > 1024) client.close(1009, 'Message too large.');
          });
        });
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\\r\\nConnection: close\\r\\n\\r\\n');
        socket.destroy();
      }
    })();
  });

  server.on('close', () => {
    clearInterval(heartbeat);
    for (const client of wss.clients) client.close(1001, 'Server shutting down.');
    sockets.clear();
  });
}

export async function closeVerificationPool() {
  if (pool) await pool.end();
}
