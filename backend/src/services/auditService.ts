import { Knex } from 'knex';
import { getDb } from '../config/database';

export interface AuditInput {
  orgId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

export const auditService = {
  async recordAudit(input: AuditInput, trx?: Knex.Transaction) {
    const db = trx || getDb();
    const [event] = await db('audit_events')
      .insert({
        org_id: input.orgId,
        actor_id: input.actorId,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        request_id: input.requestId || null,
        old_values: input.oldValues ? JSON.stringify(input.oldValues) : null,
        new_values: input.newValues ? JSON.stringify(input.newValues) : null,
      })
      .returning('*');
    return event;
  },

  async getAuditLog(
    orgId: string,
    filters: { action?: string; resourceType?: string; actorId?: string },
    limit: number,
    offset: number,
  ) {
    const baseQuery = getDb()('audit_events as ae')
      .leftJoin('users as u', 'u.id', 'ae.actor_id')
      .where('ae.org_id', orgId);

    if (filters.action) baseQuery.andWhere('ae.action', filters.action);
    if (filters.resourceType) baseQuery.andWhere('ae.resource_type', filters.resourceType);
    if (filters.actorId) baseQuery.andWhere('ae.actor_id', filters.actorId);

    const countRow = await baseQuery.clone().count<{ count: string }[]>('ae.id as count').first();
    const rows = await baseQuery
      .clone()
      .select(
        'ae.*',
        'u.first_name as actor_first_name',
        'u.last_name as actor_last_name',
        'u.email as actor_email',
      )
      .orderBy('ae.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count || 0) };
  },
};
