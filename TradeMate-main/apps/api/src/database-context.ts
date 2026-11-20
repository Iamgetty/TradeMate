import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';

type DatabaseRequestContext = { sessionTokenHash: string };
const requestContext = new AsyncLocalStorage<DatabaseRequestContext>();

export const sessionTokenFromCookieHeader = (cookieHeader?: string): string => {
  const cookie = cookieHeader?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('trademate_session='));
  if (!cookie) return '';
  try {
    return decodeURIComponent(cookie.slice('trademate_session='.length));
  } catch {
    return '';
  }
};

export const databaseRequestContextMiddleware = (request: Request, _response: Response, next: NextFunction) => {
  const token = sessionTokenFromCookieHeader(request.headers.cookie);
  const sessionTokenHash = token ? createHash('sha256').update(token).digest('hex') : '';
  requestContext.run({ sessionTokenHash }, next);
};

const establishTransactionContext = async (client: PoolClient, context: DatabaseRequestContext) => {
  const rawKey = process.env.RLS_CONTEXT_HMAC_KEY || '';
  if (!/^[0-9a-f]{64}$/i.test(rawKey)) {
    throw new Error('RLS_CONTEXT_HMAC_KEY must be configured as 64 hexadecimal characters.');
  }

  // Bind the assertion to the exact transaction and backend. The database
  // verifier independently checks both values before resolving the session.
  const transaction = await client.query(
    'SELECT txid_current()::text AS transaction_id, pg_backend_pid()::text AS backend_pid',
  );
  const transactionId = transaction.rows[0].transaction_id as string;
  const backendPid = transaction.rows[0].backend_pid as string;
  const payload = `trademate-rls-context:v1|${transactionId}|${backendPid}|${context.sessionTokenHash}`;
  const signature = createHmac('sha256', Buffer.from(rawKey, 'hex')).update(payload, 'utf8').digest('hex');

  await client.query(
    "SELECT set_config('app.session_token_hash', $1, true), set_config('app.session_transaction_id', $2, true), set_config('app.session_backend_pid', $3, true), set_config('app.session_signature', $4, true)",
    [context.sessionTokenHash, transactionId, backendPid, signature],
  );
};

const matchesSqlCommand = (sql: unknown, command: string) => {
  if (typeof sql !== 'string') return false;
  const normalized = sql.trimStart().toUpperCase();
  return normalized === command || normalized.startsWith(command + ' ') ||
    normalized.startsWith(command + ';') || normalized.startsWith(command + '\n') ||
    normalized.startsWith(command + '\t');
};
const isBeginCommand = (sql: unknown) => matchesSqlCommand(sql, 'BEGIN');
const isCommitCommand = (sql: unknown) => matchesSqlCommand(sql, 'COMMIT');
const isRollbackCommand = (sql: unknown) => matchesSqlCommand(sql, 'ROLLBACK');

/**
 * Wraps every API query in a transaction and establishes an API-signed,
 * transaction-bound identity assertion. This is groundwork for RLS; it does
 * not enable RLS or replace endpoint authorization.
 */
export const createRlsAwarePool = (pool: Pool): Pool => new Proxy(pool, {
  get(target, property, receiver) {
    if (property === 'query') {
      return async (...args: unknown[]) => {
        const context = requestContext.getStore();
        if (!context) return (target.query as (...queryArgs: unknown[]) => unknown).apply(target, args);

        const client = await target.connect();
        try {
          await client.query('BEGIN');
          await establishTransactionContext(client, context);
          const result = await (client.query as (...queryArgs: unknown[]) => unknown).apply(client, args);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      };
    }

    if (property === 'connect') {
      return async () => {
        const client = await target.connect();
        const context = requestContext.getStore();
        if (!context) return client;

        let inTransaction = false;
        let released = false;
        const contextualClient = new Proxy(client, {
          get(inner, innerProperty, innerReceiver) {
            if (innerProperty === 'query') {
              return async (...args: unknown[]) => {
                const sql = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: unknown } | undefined)?.text;

                if (isBeginCommand(sql)) {
                  const result = await (inner.query as (...queryArgs: unknown[]) => unknown).apply(inner, args);
                  inTransaction = true;
                  try {
                    await establishTransactionContext(inner, context);
                    return result;
                  } catch (error) {
                    await inner.query('ROLLBACK').then(() => {
                      inTransaction = false;
                    }).catch(() => undefined);
                    throw error;
                  }
                }

                if (isCommitCommand(sql) || isRollbackCommand(sql)) {
                  const result = await (inner.query as (...queryArgs: unknown[]) => unknown).apply(inner, args);
                  inTransaction = false;
                  return result;
                }

                if (inTransaction) {
                  return (inner.query as (...queryArgs: unknown[]) => unknown).apply(inner, args);
                }

                await inner.query('BEGIN');
                await establishTransactionContext(inner, context);
                try {
                  const result = await (inner.query as (...queryArgs: unknown[]) => unknown).apply(inner, args);
                  await inner.query('COMMIT');
                  return result;
                } catch (error) {
                  await inner.query('ROLLBACK').catch(() => undefined);
                  throw error;
                }
              };
            }

            if (innerProperty === 'release') {
              return (releaseError?: Error | boolean) => {
                if (released) return;
                released = true;
                if (inTransaction) {
                  void inner.query('ROLLBACK')
                    .catch(() => undefined)
                    .finally(() => inner.release(releaseError));
                  return;
                }
                inner.release(releaseError);
              };
            }

            const value = Reflect.get(inner, innerProperty, innerReceiver);
            return typeof value === 'function' ? value.bind(inner) : value;
          },
        });
        return contextualClient;
      };
    }

    const value = Reflect.get(target, property, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
