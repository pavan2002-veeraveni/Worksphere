import { Knex } from 'knex';
import { getDb } from '../config/database';
import { withOptimisticLock } from '../utils/optimisticLock';

export interface ProjectFilters {
  status?: string;
  priority?: string;
  search?: string;
}

export const projectRepository = {
  db(): Knex {
    return getDb();
  },

  async findByOrgId(orgId: string, filters: ProjectFilters, limit: number, offset: number) {
    const baseQuery = this.db()('projects').where({ org_id: orgId });
    if (filters.status) baseQuery.andWhere({ status: filters.status });
    if (filters.priority) baseQuery.andWhere({ priority: filters.priority });
    if (filters.search) {
      baseQuery.andWhere((qb) => {
        qb.whereILike('name', `%${filters.search}%`).orWhereILike('description', `%${filters.search}%`);
      });
    }

    const countRow = await baseQuery.clone().count<{ count: string }[]>('* as count').first();
    const rows = await baseQuery
      .clone()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return { rows, total: Number(countRow?.count || 0) };
  },

  async findById(orgId: string, projectId: string) {
    return this.db()('projects').where({ id: projectId, org_id: orgId }).first();
  },

  async create(orgId: string, userId: string, data: Record<string, unknown>) {
    const [created] = await this.db()('projects')
      .insert({
        org_id: orgId,
        name: data.name,
        description: data.description ?? null,
        status: data.status ?? 'planning',
        priority: data.priority ?? 'medium',
        start_date: data.startDate ?? null,
        end_date: data.endDate ?? null,
        created_by: userId,
        team_id: data.teamId ?? null,
        settings: JSON.stringify(data.settings ?? {}),
      })
      .returning('*');
    return created;
  },

  async updateWithLock(
    trx: Knex.Transaction,
    orgId: string,
    projectId: string,
    version: number,
    data: Record<string, unknown>,
  ) {
    const mapped: Record<string, unknown> = {};
    if (data.name !== undefined) mapped.name = data.name;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.priority !== undefined) mapped.priority = data.priority;
    if (data.startDate !== undefined) mapped.start_date = data.startDate;
    if (data.endDate !== undefined) mapped.end_date = data.endDate;
    if (data.teamId !== undefined) mapped.team_id = data.teamId;
    if (data.settings !== undefined) mapped.settings = JSON.stringify(data.settings);

    return withOptimisticLock(trx, 'projects', projectId, version, mapped, { org_id: orgId });
  },

  async delete(orgId: string, projectId: string) {
    const count = await this.db()('projects').where({ id: projectId, org_id: orgId }).del();
    return count > 0;
  },

  async findMilestones(projectId: string) {
    return this.db()('milestones').where({ project_id: projectId }).orderBy('sort_order', 'asc');
  },

  async createMilestone(projectId: string, data: Record<string, unknown>) {
    const [row] = await this.db()('milestones')
      .insert({
        project_id: projectId,
        name: data.name,
        description: data.description ?? null,
        due_date: data.dueDate ?? null,
        status: data.status ?? 'pending',
        sort_order: data.sortOrder ?? 0,
      })
      .returning('*');
    return row;
  },

  async updateMilestone(projectId: string, milestoneId: string, data: Record<string, unknown>) {
    const mapped: Record<string, unknown> = { updated_at: this.db().fn.now() };
    if (data.name !== undefined) mapped.name = data.name;
    if (data.description !== undefined) mapped.description = data.description;
    if (data.dueDate !== undefined) mapped.due_date = data.dueDate;
    if (data.status !== undefined) mapped.status = data.status;
    if (data.sortOrder !== undefined) mapped.sort_order = data.sortOrder;

    const [row] = await this.db()('milestones')
      .where({ id: milestoneId, project_id: projectId })
      .update(mapped)
      .returning('*');
    return row;
  },

  async deleteMilestone(projectId: string, milestoneId: string) {
    const count = await this.db()('milestones').where({ id: milestoneId, project_id: projectId }).del();
    return count > 0;
  },
};
