import crypto from 'crypto';
import { config } from '../config';
import { getDb } from '../config/database';
import { emailService } from '../integrations/emailService';
import { organizationRepository } from '../repositories/organizationRepository';
import { ApiError } from '../utils/ApiError';
import { auditService } from './auditService';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const organizationService = {
  async listUserOrganizations(userId: string) {
    return organizationRepository.findByUserId(userId);
  },

  async getOrganization(orgId: string) {
    const org = await organizationRepository.findById(orgId);
    if (!org) throw ApiError.notFound('Organization not found');
    return org;
  },

  async createOrganization(
    userId: string,
    data: { name: string; slug?: string; plan?: string; settings?: Record<string, unknown> },
  ) {
    const slug = data.slug || `${slugify(data.name)}-${crypto.randomBytes(2).toString('hex')}`;
    const existing = await organizationRepository.findBySlug(slug);
    if (existing) {
      throw ApiError.conflict('Organization slug already in use', undefined, 'SLUG_EXISTS');
    }

    const org = await organizationRepository.create({ ...data, slug }, userId);
    await auditService.recordAudit({
      orgId: org.id,
      actorId: userId,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: org.id,
      newValues: org,
    });
    return org;
  },

  async updateOrganization(orgId: string, actorId: string, data: Record<string, unknown>) {
    const existing = await this.getOrganization(orgId);
    const updated = await organizationRepository.update(orgId, data);
    await auditService.recordAudit({
      orgId,
      actorId,
      action: 'organization.updated',
      resourceType: 'organization',
      resourceId: orgId,
      oldValues: existing,
      newValues: updated,
    });
    return updated;
  },

  async deleteOrganization(orgId: string) {
    const deleted = await organizationRepository.delete(orgId);
    if (!deleted) throw ApiError.notFound('Organization not found');
  },

  async listMembers(orgId: string, limit: number, offset: number) {
    return organizationRepository.findMembers(orgId, limit, offset);
  },

  async updateMemberRole(orgId: string, memberId: string, role: string, actorId: string) {
    const updated = await organizationRepository.updateMemberRole(orgId, memberId, role);
    if (!updated) throw ApiError.notFound('Organization member not found');

    await auditService.recordAudit({
      orgId,
      actorId,
      action: 'organization.member_role_updated',
      resourceType: 'organization_member',
      resourceId: memberId,
      newValues: { role },
    });
    return updated;
  },

  async removeMember(orgId: string, memberId: string, actorId: string) {
    const deleted = await organizationRepository.removeMember(orgId, memberId);
    if (!deleted) throw ApiError.notFound('Organization member not found');

    await auditService.recordAudit({
      orgId,
      actorId,
      action: 'organization.member_removed',
      resourceType: 'organization_member',
      resourceId: memberId,
    });
  },

  async inviteMember(orgId: string, invitedBy: string, email: string, role: string) {
    const org = await this.getOrganization(orgId);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    const [invitation] = await getDb()('invitations')
      .insert({
        org_id: orgId,
        email: email.toLowerCase().trim(),
        role,
        token,
        invited_by: invitedBy,
        status: 'pending',
        expires_at: expiresAt,
      })
      .returning('*');

    const inviteLink = `${config.appUrl}/invitations/${token}`;
    await emailService.sendInvitationEmail(email, org.name, inviteLink, role).catch(() => undefined);

    await auditService.recordAudit({
      orgId,
      actorId: invitedBy,
      action: 'organization.member_invited',
      resourceType: 'invitation',
      resourceId: invitation.id,
      newValues: { email: invitation.email, role },
    });

    return invitation;
  },

  async listInvitations(orgId: string) {
    return getDb()('invitations').where({ org_id: orgId }).orderBy('created_at', 'desc');
  },

  async acceptInvitation(token: string, userId: string, userEmail: string) {
    const db = getDb();
    return db.transaction(async (trx) => {
      const invite = await trx('invitations').where({ token }).first();
      if (!invite) {
        throw ApiError.notFound('Invitation not found');
      }
      if (invite.status !== 'pending') {
        throw ApiError.badRequest(`Invitation is already ${invite.status}`);
      }
      if (new Date(invite.expires_at).getTime() <= Date.now()) {
        await trx('invitations').where({ id: invite.id }).update({ status: 'expired' });
        throw ApiError.badRequest('Invitation has expired');
      }
      if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw ApiError.forbidden('Invitation belongs to a different email address');
      }

      const [member] = await trx('organization_members')
        .insert({
          org_id: invite.org_id,
          user_id: userId,
          role: invite.role,
          invited_by: invite.invited_by,
        })
        .onConflict(['org_id', 'user_id'])
        .merge({ role: invite.role })
        .returning('*');

      await trx('invitations').where({ id: invite.id }).update({ status: 'accepted' });
      return member;
    });
  },

  async revokeInvitation(orgId: string, invitationId: string) {
    const [updated] = await getDb()('invitations')
      .where({ id: invitationId, org_id: orgId, status: 'pending' })
      .update({ status: 'revoked' })
      .returning('*');
    if (!updated) throw ApiError.notFound('Pending invitation not found');
    return updated;
  },
};
