import { getDb } from '../config/database';
import { ApiError } from '../utils/ApiError';

export const workflowRuleService = {
  async list(orgId: string, limit: number, offset: number) {
    const baseQuery = getDb()('workflow_rules').where({ org_id: orgId });
    const countRow = await baseQuery.clone().count<{ count: string }[]>('* as count').first();
    const rows = await baseQuery.clone().orderBy('created_at', 'desc').limit(limit).offset(offset);
    return { rows, total: Number(countRow?.count || 0) };
  },

  async getById(orgId: string, ruleId: string) {
    const rule = await getDb()('workflow_rules').where({ id: ruleId, org_id: orgId }).first();
    if (!rule) throw ApiError.notFound('Workflow rule not found');
    return rule;
  },

  async create(orgId: string, userId: string, data: Record<string, unknown>) {
    const [rule] = await getDb()('workflow_rules')
      .insert({
        org_id: orgId,
        project_id: data.projectId ?? null,
        name: data.name,
        description: data.description ?? null,
        trigger_event: data.triggerEvent,
        conditions: JSON.stringify(data.conditions || []),
        actions: JSON.stringify(data.actions || []),
        is_active: data.isActive ?? true,
        created_by: userId,
      })
      .returning('*');
    return rule;
  },

  async update(orgId: string, ruleId: string, data: Record<string, unknown>) {
    const mapped: Record<string, unknown> = { updated_at: getDb().fn.now() };
    if (data.projectId !== undefined) mapped.project_id = data.projectId;
    if (data.name !== undefined) mapped.name = data.name;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.triggerEvent !== undefined) mapped.trigger_event = data.triggerEvent;
    if (data.conditions !== undefined) mapped.conditions = JSON.stringify(data.conditions);
    if (data.actions !== undefined) mapped.actions = JSON.stringify(data.actions);
    if (data.isActive !== undefined) mapped.is_active = data.isActive;

    const [updated] = await getDb()('workflow_rules')
      .where({ id: ruleId, org_id: orgId })
      .update(mapped)
      .returning('*');
    if (!updated) throw ApiError.notFound('Workflow rule not found');
    return updated;
  },

  async remove(orgId: string, ruleId: string) {
    const deleted = await getDb()('workflow_rules').where({ id: ruleId, org_id: orgId }).del();
    if (!deleted) throw ApiError.notFound('Workflow rule not found');
  },
};
