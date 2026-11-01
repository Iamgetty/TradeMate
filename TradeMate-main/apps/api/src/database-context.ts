import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';

type DatabaseRequestContext = { sessionTokenHash: string; userId: string; userResolved: boolean };
const requestContext = new AsyncLocalStorage<DatabaseRequestContext>();

const sessionCookieToken = (request: Request): string => {
  const cookie = request.headers.cookie?.split(';')
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
  const token = sessionCookieToken(request);
  const sessionTokenHash = token ? createHash('sha256').update(token).digest('hex') : '';
  requestContext.run({ sessionTokenHash, userId: '', userResolved: false }, next);
};

const establishTransactionContext = async (client: PoolClient, context: DatabaseRequestContext) => {
  await client.query("SELECT set_config('app.session_token_hash', $1, true)", [context.sessionTokenHash]);

  // Resolve identity from the hashed, unexpired server-side session. The initial
  // lookup is allowed by the future session-hash RLS policy; user_id itself is
  // never accepted from the browser or request body.
  if (!context.userResolved) {
    if (context.sessionTokenHash) {
      const session = await client.query(
        "SELECT s.user_id::text AS user_id FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active' LIMIT 1",
        [context.sessionTokenHash],
      );
      context.userId = session.rows[0]?.user_id || '';
    }
    context.userResolved = true;
  }

  await client.query("SELECT set_config('app.user_id', $1, true)", [context.userId]);
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
 * Wraps every API query in a transaction and sets identity context transaction-locally.
 * Explicit multi-query transactions retain the same context on their checked-out client.
 * This is groundwork for RLS; it does not enable RLS or replace endpoint authorization.
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
                  await establishTransactionContext(inner, context);
                  inTransaction = true;
                  return result;
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
