import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';

type DatabaseRequestContext = { sessionTokenHash: string };
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
  requestContext.run({ sessionTokenHash }, next);
};

const establishTransactionContext = async (client: PoolClient, context: DatabaseRequestContext) => {
  await client.query("SELECT set_config('app.session_token_hash', $1, true)", [context.sessionTokenHash]);
};

const isTransactionCommand = (sql: unknown, command: 'BEGIN' | 'COMMIT' | 'ROLLBACK') =>
  typeof sql === 'string' && new RegExp('^\\s*' + command + '\\b', 'i').test(sql);

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

                if (isTransactionCommand(sql, 'BEGIN')) {
                  const result = await (inner.query as (...queryArgs: unknown[]) => unknown).apply(inner, args);
                  await establishTransactionContext(inner, context);
                  inTransaction = true;
                  return result;
                }

                if (isTransactionCommand(sql, 'COMMIT') || isTransactionCommand(sql, 'ROLLBACK')) {
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
              return (...releaseArgs: unknown[]) => {
                if (released) return;
                released = true;
                if (inTransaction) {
                  void inner.query('ROLLBACK')
                    .catch(() => undefined)
                    .finally(() => inner.release(...releaseArgs));
                  return;
                }
                inner.release(...releaseArgs);
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
