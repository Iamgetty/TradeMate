import { z } from 'zod';

const postgresUrl = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'postgres:' || protocol === 'postgresql:';
}, 'Must be a PostgreSQL connection URL.');

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).optional(),
  PORT: z.string().regex(/^\d{1,5}$/).optional(),
  DATABASE_URL: postgresUrl.optional(),
  MIGRATION_DATABASE_URL: postgresUrl.optional(),
  PGSSLMODE: z.enum(['require', 'disable']).optional(),
  TOTP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  RLS_CONTEXT_HMAC_KEY: z.string().regex(/^[0-9a-f]{64}$/i).optional(),
  WEB_ORIGIN: z.string().max(2048).refine((value) =>
    value.split(',').every((origin) => {
      const parsed = z.string().url().safeParse(origin.trim());
      if (!parsed.success) return false;
      const url = new URL(origin.trim());
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    }),
    'Every configured web origin must use HTTPS (HTTP is allowed only for localhost).',
  ).optional(),
  PERSONA_WEBHOOK_SECRET: z.string().min(1).optional(),
  PERSONA_API_KEY: z.string().min(1).optional(),
  PERSONA_INQUIRY_TEMPLATE_ID: z.string().regex(/^itmpl_[A-Za-z0-9]+$/).optional(),
  PERSONA_REDIRECT_URI: z.string().url().refine((value) => { const url = new URL(value); return url.protocol === 'https:' && ['trademate.cfd', 'www.trademate.cfd'].includes(url.hostname); }, 'Must be an HTTPS TradeMate domain.').optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().refine((value) => {
    const trimmed = value.trim();
    if (z.string().email().safeParse(trimmed).success) return true;
    const match = trimmed.match(/^(?:"[^"\r\n]+"|[^"<>\r\n]+?)\s*<([^<>\s]+)>$/);
    return Boolean(match && z.string().email().safeParse(match[1]).success);
  }, 'Must be a valid email address, optionally with a display name (for example: TradeMate <noreply@trademate.cfd>).').optional(),
}).passthrough();

export const validateEnvironment = (input: Record<string, string | undefined> = process.env) => {
  const parsed = environmentSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const key = issue.path.join('.') || 'environment';
      return key + ': ' + issue.message;
    });
    throw new Error('Invalid TradeMate API environment configuration: ' + issues.join('; '));
  }

  if (parsed.data.NODE_ENV === 'production') {
    const missing = [
      !parsed.data.DATABASE_URL ? 'DATABASE_URL' : null,
      !parsed.data.TOTP_ENCRYPTION_KEY ? 'TOTP_ENCRYPTION_KEY' : null,
      !parsed.data.RLS_CONTEXT_HMAC_KEY ? 'RLS_CONTEXT_HMAC_KEY' : null,
    ].filter(Boolean);
    if (missing.length) {
      throw new Error('Missing required production environment variables: ' + missing.join(', '));
    }
  }

  return parsed.data;
};
