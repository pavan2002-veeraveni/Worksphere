import { Knex } from 'knex';
import { ApiError } from './ApiError';

export class ConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(409, 'OPTIMISTIC_LOCK_CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}

/**
 * Atomically update a versioned record only if its current version matches expectedVersion.
 * Increments version by 1 and throws ConflictError (HTTP 409) on concurrent modification.
 */
export async function withOptimisticLock<T extends Record<string, unknown>>(
  trx: Knex | Knex.Transaction,
  table: string,
  id: string,
  expectedVersion: number,
  updateData: Record<string, unknown>,
  scopeFilter: Record<string, unknown> = {},
): Promise<T> {
  const updatedRows = await trx(table)
    .where({ id, version: expectedVersion, ...scopeFilter })
    .update({
      ...updateData,
      version: expectedVersion + 1,
      updated_at: trx.fn.now(),
    })
    .returning('*');

  if (updatedRows.length > 0) {
    return updatedRows[0] as T;
  }

  const existing = await trx(table).where({ id, ...scopeFilter }).first();
  if (!existing) {
    throw ApiError.notFound(`${table.slice(0, -1)} not found`);
  }

  throw new ConflictError(
    `Concurrent modification detected on ${table.slice(0, -1)}: expected version ${expectedVersion}, actual version ${existing.version}`,
    {
      expectedVersion,
      currentVersion: existing.version,
      currentRecord: existing,
    },
  );
}
