import { Knex } from 'knex';
import { getDb } from '../config/database';

export const organizationRepository = {
  db(): Knex {
    return getDb();
  },

  async findById(id: string) {
    return this.db()('organizations').where({ id }).first();
  },

  async findBySlug(slug: string) {
    return this.db()('organizations').where({ slug }).first();
  },

  async findByUserId(userId: string) {
    return this.db()('organizations as o')
      .join('organization_members as om', 'om.org_id', 'o.id')
      .where('om.user_id', userId)
      .select('o.*', 'om.role as member_role', 'om.joined_at')
      .orderBy('o.created_at', 'asc');
  },

  async create(
    data: { name: string; slug: string; plan?: string; settings?: Record<string, unknown> },
    ownerUserId: string,
  ) {
    return this.db().transaction(async (trx) => {
      const [org] = await trx('organizations')
        .insert({
          name: data.name,
          slug: data.slug,
          plan: data.plan || 'free',
          settings: JSON.stringify(data.settings || {}),
        })
        .returning('*');

      await trx('organization_members').insert({
        org_id: org.id,
        user_id: ownerUserId,
        role: 'owner',
        invited_by: ownerUserId,
      });

      return org;
    });
  },

  async update(id: string, data: Record<string, unknown>) {
    const updateFields: Record<string, unknown> = { updated_at: this.db().fn.now() };
    if (data.name !== undefined) updateFields.name = data.name;
    if (data.plan !== undefined) updateFields.plan = data.plan;
    if (data.logoUrl !== undefined) updateFields.logo_url = data.logoUrl;
    if (data.settings !== undefined) updateFields.settings = JSON.stringify(data.settings);

    const [updated] = await this.db()('organizations').where({ id }).update(updateFields).returning('*');
    return updated;
  },

  async delete(id: string) {
    const count = await this.db()('organizations').where({ id }).del();
    return count > 0;
  },

  async findMembers(orgId: string, limit: number, offset: number) {
    const rows = await this.db()('organization_members as om')
      .join('users as u', 'u.id', 'om.user_id')
      .where('om.org_id', orgId)
      .select(
        'om.id',
        'om.org_id',
        'om.user_id',
        'om.role',
        'om.joined_at',
        'u.email',
        'u.first_name',
        'u.last_name',
        'u.avatar_url',
        'u.is_active',
      )
      .orderBy('om.joined_at', 'asc')
      .limit(limit)
      .offset(offset);

    const countRow = await this.db()('organization_members')
      .where({ org_id: orgId })
      .count<{ count: string }[]>('* as count')
      .first();

    return { rows, total: Number(countRow?.count || 0) };
  },

  async findMemberByUser(orgId: string, userId: string) {
    return this.db()('organization_members').where({ org_id: orgId, user_id: userId }).first();
  },

  async updateMemberRole(orgId: string, memberId: string, role: string) {
    const [updated] = await this.db()('organization_members')
      .where({ id: memberId, org_id: orgId })
      .update({ role })
      .returning('*');
    return updated;
  },

  async removeMember(orgId: string, memberId: string) {
    const count = await this.db()('organization_members').where({ id: memberId, org_id: orgId }).del();
    return count > 0;
  },
};
