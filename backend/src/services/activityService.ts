import { Knex } from 'knex';
import { getDb } from '../config/database';

export interface ActivityInput {
  orgId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const activityService = {
  async logActivity(input: ActivityInput, trx?: Knex.Transaction) {
    const db = trx || getDb();
    const [entry] = await db('activity_log')
      .insert({
        org_id: input.orgId,
        project_id: input.projectId ?? null,
        task_id: input.taskId ?? null,
        actor_id: input.actorId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId,
        changes: JSON.stringify(input.changes || {}),
        metadata: JSON.stringify(input.metadata || {}),
      })
      .returning('*');
    return entry;
  },

  async getActivityTimeline(
    orgId: string,
    filters: { projectId?: string; taskId?: string; actorId?: string },
    limit: number,
    offset: number,
  ) {
    const baseQuery = getDb()('activity_log as al')
      .leftJoin('users as u', 'u.id', 'al.actor_id')
      .where('al.org_id', orgId);

    if (filters.projectId) baseQuery.andWhere('al.project_id', filters.projectId);
    if (filters.taskId) baseQuery.andWhere('al.task_id', filters.taskId);
    if (filters.actorId) baseQuery.andWhere('al.actor_id', filters.actorId);

    const countRow = await baseQuery.clone().count<{ count: string }[]>('al.id as count').first();
    const rows = await baseQuery
      .clone()
      .select(
        'al.*',
        'u.first_name as actor_first_name',
        'u.last_name as actor_last_name',
        'u.email as actor_email',
      )
      .orderBy('al.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count || 0) };
  },

  async getTaskActivity(orgId: string, taskId: string, limit: number, offset: number) {
    return this.getActivityTimeline(orgId, { taskId }, limit, offset);
  },
};
