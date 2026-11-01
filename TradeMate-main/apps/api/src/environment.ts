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
  WEB_ORIGIN: z.string().max(2048).refine((value) =>
    value.split(',').every((origin) => {
      const parsed = z.string().url().safeParse(origin.trim());
      if (!parsed.success) return false;
      const url = new URL(origin.trim());
      return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
    }),
    'Every configured web origin must use HTTPS (HTTP is allowed only for localhost).',
  ).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
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
    ].filter(Boolean);
    if (missing.length) {
      throw new Error('Missing required production environment variables: ' + missing.join(', '));
    }
  }

  return parsed.data;
};
