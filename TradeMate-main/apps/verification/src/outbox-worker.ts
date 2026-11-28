import { randomUUID } from 'node:crypto';
import type { OutboxRecord, VeriFirePersistence } from './repository-contracts.js';

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,47}$/;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_LEASE_MS = 60_000;
const MAX_BACKOFF_MS = 15 * 60_000;

export class OutboxDispatchError extends Error {
  constructor(readonly code = 'DISPATCH_FAILED') {
    super('The queued event could not be dispatched.');
    this.name = 'OutboxDispatchError';
  }
}

export interface OutboxHandler {
  handle(event: Readonly<OutboxRecord>): Promise<void>;
}

export interface DispatchOutboxOptions {
  workerId: string;
  handlers: Readonly<Record<string, OutboxHandler>>;
  now?: Date;
  batchSize?: number;
  leaseMs?: number;
  maxAttempts?: number;
}

export interface DispatchOutboxSummary {
  claimed: number;
  delivered: number;
  rescheduled: number;
  deadLettered: number;
  leaseLost: number;
}

/** Capped exponential retry schedule; attempt count is incremented at claim time. */
export function outboxRetryDelayMs(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Attempt must be a positive integer.');
  return Math.min(1_000 * (2 ** Math.min(attempt - 1, 20)), MAX_BACKOFF_MS);
}

/**
 * Dispatch at-least-once events. Claims and acknowledgements are short database
 * transactions; handler/network work always runs outside those transactions.
 * Handlers must be idempotent because a worker can crash after handling but
 * before acknowledgement.
 */
export async function dispatchOutboxBatch(
  persistence: VeriFirePersistence,
  options: DispatchOutboxOptions,
): Promise<DispatchOutboxSummary> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (
    !options.workerId ||
    options.workerId.length > 128 ||
    !Number.isFinite(now.getTime()) ||
    !Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100 ||
    !Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > 10 * 60_000 ||
    !Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20
  ) {
    throw new Error('Invalid outbox worker configuration.');
  }

  const claimed = await persistence.withTransaction((tx) =>
    tx.outbox.claimDue({
      workerId: options.workerId,
      now: now.toISOString(),
      leaseUntil: new Date(now.getTime() + leaseMs).toISOString(),
      limit: batchSize,
    }),
  );

  const summary: DispatchOutboxSummary = {
    claimed: claimed.length,
    delivered: 0,
    rescheduled: 0,
    deadLettered: 0,
    leaseLost: 0,
  };

  for (const event of claimed) {
    if (!event.leaseToken) {
      summary.leaseLost += 1;
      continue;
    }
    let failureCode: string | null = null;
    try {
      const handler = options.handlers[event.eventType];
      if (!handler) throw new OutboxDispatchError('HANDLER_UNAVAILABLE');
      await handler.handle(event);
    } catch (error) {
      const candidate = error instanceof OutboxDispatchError ? error.code : 'DISPATCH_FAILED';
      failureCode = ERROR_CODE_PATTERN.test(candidate) ? candidate : 'DISPATCH_FAILED';
    }

    if (failureCode === null) {
      const acknowledged = await persistence.withTransaction((tx) =>
        tx.outbox.markDelivered(event.id, event.leaseToken!, now.toISOString()),
      );
      if (acknowledged) summary.delivered += 1;
      else summary.leaseLost += 1;
      continue;
    }

    const deadLetter = event.attempts >= maxAttempts;
    const availableAt = deadLetter
      ? now.toISOString()
      : new Date(now.getTime() + outboxRetryDelayMs(event.attempts)).toISOString();
    const rescheduled = await persistence.withTransaction((tx) =>
      tx.outbox.reschedule({
        eventId: event.id,
        leaseToken: event.leaseToken!,
        availableAt,
        updatedAt: now.toISOString(),
        errorCode: failureCode!,
        deadLetter,
      }),
    );
    if (!rescheduled) summary.leaseLost += 1;
    else if (deadLetter) summary.deadLettered += 1;
    else summary.rescheduled += 1;
  }

  return summary;
}
