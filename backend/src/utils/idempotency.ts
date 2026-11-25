import crypto from 'crypto';
import { Knex } from 'knex';

export function generateIdempotencyKey(prefix: string, ...parts: Array<string | number>): string {
  const raw = `${prefix}:${parts.join(':')}`;
  if (raw.length <= 200) {
    return raw;
  }
  const digest = crypto.createHash('sha256').update(raw).digest('hex');
  return `${prefix}:${digest}`;
}

export async function checkProcessedEvent(db: Knex, eventId: string): Promise<boolean> {
  const existing = await db('processed_events').where({ event_id: eventId }).first('id');
  return Boolean(existing);
}

export async function recordProcessedEvent(
  db: Knex,
  eventId: string,
  eventType: string,
  result: Record<string, unknown> = {},
): Promise<boolean> {
  const inserted = await db('processed_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      result: JSON.stringify(result),
    })
    .onConflict('event_id')
    .ignore()
    .returning('id');
  return inserted.length > 0;
}

/**
 * Execute an asynchronous action exactly once per unique eventId.
 * Uses an atomic INSERT ... ON CONFLICT DO NOTHING claim or DB transaction so
 * concurrent worker retries cannot duplicate side effects.
 */
export async function withIdempotency<T>(
  db: Knex,
  eventId: string,
  eventType: string,
  fn: () => Promise<T>,
): Promise<{ skipped: boolean; result?: T }> {
  const claimed = await recordProcessedEvent(db, eventId, eventType, { status: 'claimed' });
  if (!claimed) {
    return { skipped: true };
  }

  try {
    const result = await fn();
    await db('processed_events')
      .where({ event_id: eventId })
      .update({ result: JSON.stringify({ status: 'completed', data: result ?? null }) });
    return { skipped: false, result };
  } catch (err) {
    // Release claim on failure so legitimate retries can execute
    await db('processed_events').where({ event_id: eventId }).del();
    throw err;
  }
}
