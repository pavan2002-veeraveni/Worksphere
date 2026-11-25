import { Knex } from 'knex';
import { getDb } from '../config/database';

export const teamRepository = {
  db(): Knex {
    return getDb();
  },

  async findByOrgId(orgId: string, limit: number, offset: number) {
    const rows = await this.db()('teams')
      .where({ org_id: orgId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const countRow = await this.db()('teams')
      .where({ org_id: orgId })
      .count<{ count: string }[]>('* as count')
      .first();

    return { rows, total: Number(countRow?.count || 0) };
  },

  async findById(orgId: string, teamId: string) {
    const team = await this.db()('teams').where({ id: teamId, org_id: orgId }).first();
    if (!team) return null;

    const members = await this.db()('team_members as tm')
      .join('users as u', 'u.id', 'tm.user_id')
      .where('tm.team_id', teamId)
      .select('tm.id', 'tm.team_id', 'tm.user_id', 'tm.role', 'u.email', 'u.first_name', 'u.last_name');

    return { ...team, members };
  },

  async create(orgId: string, data: { name: string; description?: string | null }) {
    const [row] = await this.db()('teams')
      .insert({ org_id: orgId, name: data.name, description: data.description ?? null })
      .returning('*');
    return row;
  },

  async update(orgId: string, teamId: string, data: { name?: string; description?: string | null }) {
    const mapped: Record<string, unknown> = { updated_at: this.db().fn.now() };
    if (data.name !== undefined) mapped.name = data.name;
    if (data.description !== undefined) mapped.description = data.description;

    const [row] = await this.db()('teams')
      .where({ id: teamId, org_id: orgId })
      .update(mapped)
      .returning('*');
    return row;
  },

  async delete(orgId: string, teamId: string) {
    const count = await this.db()('teams').where({ id: teamId, org_id: orgId }).del();
    return count > 0;
  },

  async addMember(teamId: string, userId: string, role: string) {
    const [row] = await this.db()('team_members')
      .insert({ team_id: teamId, user_id: userId, role })
      .onConflict(['team_id', 'user_id'])
      .merge({ role })
      .returning('*');
    return row;
  },

  async removeMember(teamId: string, userId: string) {
    const count = await this.db()('team_members').where({ team_id: teamId, user_id: userId }).del();
    return count > 0;
  },
};
