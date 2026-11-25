import { getDb } from '../config/database';
import { ProjectFilters, projectRepository } from '../repositories/projectRepository';
import { ApiError } from '../utils/ApiError';
import { emitToOrg } from '../websocket/socketManager';
import { activityService } from './activityService';
import { auditService } from './auditService';

export const projectService = {
  async list(orgId: string, filters: ProjectFilters, limit: number, offset: number) {
    return projectRepository.findByOrgId(orgId, filters, limit, offset);
  },

  async getById(orgId: string, projectId: string) {
    const project = await projectRepository.findById(orgId, projectId);
    if (!project) throw ApiError.notFound('Project not found');
    return project;
  },

  async create(orgId: string, userId: string, data: Record<string, unknown>) {
    const project = await projectRepository.create(orgId, userId, data);

    await activityService.logActivity({
      orgId,
      projectId: project.id,
      actorId: userId,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      metadata: { name: project.name },
    });

    await auditService.recordAudit({
      orgId,
      actorId: userId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
      newValues: project,
    });

    emitToOrg(orgId, 'project:created', project);
    return project;
  },

  async update(
    orgId: string,
    projectId: string,
    userId: string,
    version: number,
    data: Record<string, unknown>,
  ) {
    const { updated, previous } = await getDb().transaction(async (trx) => {
      const existing = await trx('projects').where({ id: projectId, org_id: orgId }).first();
      if (!existing) throw ApiError.notFound('Project not found');

      const next = await projectRepository.updateWithLock(trx, orgId, projectId, version, data);

      await activityService.logActivity(
        {
          orgId,
          projectId,
          actorId: userId,
          action: 'project.updated',
          entityType: 'project',
          entityId: projectId,
          changes: { version: { from: existing.version, to: next.version } },
        },
        trx,
      );

      await auditService.recordAudit(
        {
          orgId,
          actorId: userId,
          action: 'project.updated',
          resourceType: 'project',
          resourceId: projectId,
          oldValues: existing,
          newValues: next,
        },
        trx,
      );

      return { updated: next, previous: existing };
    });

    emitToOrg(orgId, 'project:updated', { project: updated, previousStatus: previous.status });
    return updated;
  },

  async remove(orgId: string, projectId: string, userId: string) {
    const existing = await this.getById(orgId, projectId);
    const deleted = await projectRepository.delete(orgId, projectId);
    if (!deleted) throw ApiError.notFound('Project not found');

    await auditService.recordAudit({
      orgId,
      actorId: userId,
      action: 'project.deleted',
      resourceType: 'project',
      resourceId: projectId,
      oldValues: existing,
    });
  },

  async listMilestones(orgId: string, projectId: string) {
    await this.getById(orgId, projectId);
    return projectRepository.findMilestones(projectId);
  },

  async createMilestone(orgId: string, projectId: string, data: Record<string, unknown>) {
    await this.getById(orgId, projectId);
    return projectRepository.createMilestone(projectId, data);
  },

  async updateMilestone(
    orgId: string,
    projectId: string,
    milestoneId: string,
    data: Record<string, unknown>,
  ) {
    await this.getById(orgId, projectId);
    const updated = await projectRepository.updateMilestone(projectId, milestoneId, data);
    if (!updated) throw ApiError.notFound('Milestone not found');
    return updated;
  },

  async deleteMilestone(orgId: string, projectId: string, milestoneId: string) {
    await this.getById(orgId, projectId);
    const deleted = await projectRepository.deleteMilestone(projectId, milestoneId);
    if (!deleted) throw ApiError.notFound('Milestone not found');
  },
};
