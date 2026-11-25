import crypto from 'crypto';
import { getDb } from '../config/database';
import { storageService } from '../integrations/storageService';
import { projectRepository } from '../repositories/projectRepository';
import { TaskFilters, taskRepository } from '../repositories/taskRepository';
import { ApiError } from '../utils/ApiError';
import { emitToOrg, emitToProject, emitToTask } from '../websocket/socketManager';
import { activityService } from './activityService';
import { auditService } from './auditService';
import { notificationService } from './notificationService';
import { workflowEngine } from './workflowEngine';

function computeFieldDiff(
  previous: Record<string, unknown>,
  updated: Record<string, unknown>,
  fields: string[],
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of fields) {
    if (previous[field] !== updated[field]) {
      diff[field] = { from: previous[field] ?? null, to: updated[field] ?? null };
    }
  }
  return diff;
}

export const taskService = {
  async list(orgId: string, filters: TaskFilters, limit: number, offset: number) {
    return taskRepository.findByOrg(orgId, filters, limit, offset);
  },

  async getById(orgId: string, taskId: string) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');

    const [subtasks, attachments, watchers] = await Promise.all([
      taskRepository.findSubtasks(taskId),
      taskRepository.findAttachments(taskId),
      taskRepository.findWatchers(taskId),
    ]);

    return { ...task, subtasks, attachments, watchers };
  },

  async create(orgId: string, userId: string, data: Record<string, unknown>) {
    const project = await projectRepository.findById(orgId, String(data.projectId));
    if (!project) {
      throw ApiError.notFound('Project not found in this organization');
    }

    const created = await getDb().transaction(async (trx) => {
      const task = await taskRepository.create(trx, userId, data);

      await activityService.logActivity(
        {
          orgId,
          projectId: project.id,
          taskId: task.id,
          actorId: userId,
          action: 'task.created',
          entityType: 'task',
          entityId: task.id,
          changes: { status: { from: null, to: task.status } },
          metadata: { title: task.title },
        },
        trx,
      );

      await auditService.recordAudit(
        {
          orgId,
          actorId: userId,
          action: 'task.created',
          resourceType: 'task',
          resourceId: task.id,
          newValues: task,
        },
        trx,
      );

      return task;
    });

    emitToProject(project.id, 'task:created', created);
    emitToOrg(orgId, 'task:created', created);

    if (created.assignee_id && created.assignee_id !== userId) {
      await notificationService.enqueueIdempotentNotification({
        idempotencyParts: ['task', created.id, 'v1', 'assigned', created.assignee_id],
        orgId,
        userId: created.assignee_id,
        type: 'task_assigned',
        title: `New task assigned: ${created.title}`,
        message: `You were assigned to "${created.title}".`,
        link: `/projects/${project.id}`,
      });
    }

    await workflowEngine.evaluateRules(orgId, 'task.created', {
      orgId,
      projectId: project.id,
      task: created,
      actorId: userId,
    });

    return created;
  },

  /**
   * Concurrent-safe task update using optimistic locking (`version`),
   * transactional activity + audit logging, and idempotent notification queuing.
   */
  async update(
    orgId: string,
    taskId: string,
    userId: string,
    version: number,
    data: Record<string, unknown>,
    requestMeta?: { ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const { updated, previous, diff } = await getDb().transaction(async (trx) => {
      const existing = await taskRepository.findByIdInOrg(orgId, taskId, trx);
      if (!existing) throw ApiError.notFound('Task not found');

      const next = await taskRepository.updateWithLock(trx, taskId, version, data);

      const trackedFields = [
        'title',
        'description',
        'status',
        'priority',
        'assignee_id',
        'due_date',
        'milestone_id',
        'estimated_hours',
        'actual_hours',
      ];
      const changes = computeFieldDiff(existing, next, trackedFields);

      let action = 'task.updated';
      if (changes.status) action = 'task.status_changed';
      else if (changes.assignee_id) action = 'task.assigned';

      await activityService.logActivity(
        {
          orgId,
          projectId: next.project_id,
          taskId: next.id,
          actorId: userId,
          action,
          entityType: 'task',
          entityId: next.id,
          changes,
          metadata: { version: next.version },
        },
        trx,
      );

      await auditService.recordAudit(
        {
          orgId,
          actorId: userId,
          action,
          resourceType: 'task',
          resourceId: next.id,
          ipAddress: requestMeta?.ipAddress,
          userAgent: requestMeta?.userAgent,
          requestId: requestMeta?.requestId,
          oldValues: existing,
          newValues: next,
        },
        trx,
      );

      return { updated: next, previous: existing, diff: changes };
    });

    emitToProject(updated.project_id, 'task:updated', updated);
    emitToTask(updated.id, 'task:updated', updated);
    emitToOrg(orgId, 'task:updated', updated);

    if (diff.assignee_id && updated.assignee_id && updated.assignee_id !== userId) {
      await notificationService.enqueueIdempotentNotification({
        idempotencyParts: ['task', updated.id, `v${updated.version}`, 'assigned', updated.assignee_id],
        orgId,
        userId: updated.assignee_id,
        type: 'task_assigned',
        title: `Assigned to task: ${updated.title}`,
        message: `You were assigned to "${updated.title}".`,
        link: `/projects/${updated.project_id}`,
      });
    } else if (diff.status && updated.assignee_id && updated.assignee_id !== userId) {
      await notificationService.enqueueIdempotentNotification({
        idempotencyParts: ['task', updated.id, `v${updated.version}`, 'status', String(updated.status)],
        orgId,
        userId: updated.assignee_id,
        type: 'task_updated',
        title: `Task status updated: ${updated.title}`,
        message: `Status changed from ${previous.status} to ${updated.status}.`,
        link: `/projects/${updated.project_id}`,
      });
    }

    const triggerEvent = diff.status
      ? 'task.status_changed'
      : diff.assignee_id
        ? 'task.assigned'
        : 'task.status_changed';

    if (diff.status || diff.assignee_id) {
      await workflowEngine.evaluateRules(orgId, triggerEvent, {
        orgId,
        projectId: updated.project_id,
        task: updated,
        actorId: userId,
      });
    }

    return updated;
  },

  async remove(orgId: string, taskId: string, userId: string) {
    const existing = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!existing) throw ApiError.notFound('Task not found');

    await taskRepository.delete(orgId, taskId);
    await auditService.recordAudit({
      orgId,
      actorId: userId,
      action: 'task.deleted',
      resourceType: 'task',
      resourceId: taskId,
      oldValues: existing,
    });
  },

  async listSubtasks(orgId: string, taskId: string) {
    const parent = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!parent) throw ApiError.notFound('Task not found');
    return taskRepository.findSubtasks(taskId);
  },

  async createSubtask(orgId: string, taskId: string, userId: string, data: Record<string, unknown>) {
    const parent = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!parent) throw ApiError.notFound('Parent task not found');

    return this.create(orgId, userId, {
      ...data,
      projectId: parent.project_id,
      parentTaskId: taskId,
    });
  },

  async listComments(orgId: string, taskId: string, limit: number, offset: number) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');
    return taskRepository.findComments(taskId, limit, offset);
  },

  async createComment(
    orgId: string,
    taskId: string,
    userId: string,
    content: string,
    parentCommentId?: string | null,
  ) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');

    const comment = await taskRepository.createComment(taskId, userId, content, parentCommentId);

    await activityService.logActivity({
      orgId,
      projectId: task.project_id,
      taskId,
      actorId: userId,
      action: 'comment.created',
      entityType: 'comment',
      entityId: comment.id,
      metadata: { taskTitle: task.title },
    });

    emitToTask(taskId, 'comment:new', comment);
    emitToProject(task.project_id, 'comment:new', comment);

    if (task.assignee_id && task.assignee_id !== userId) {
      await notificationService.enqueueIdempotentNotification({
        idempotencyParts: ['comment', comment.id],
        orgId,
        userId: task.assignee_id,
        type: 'comment_added',
        title: `New comment on ${task.title}`,
        message: content.slice(0, 140),
        link: `/projects/${task.project_id}`,
      });
    }

    await workflowEngine.evaluateRules(orgId, 'comment.created', {
      orgId,
      projectId: task.project_id,
      task,
      actorId: userId,
    });

    return comment;
  },

  async updateComment(orgId: string, taskId: string, commentId: string, userId: string, content: string) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');
    const updated = await taskRepository.updateComment(taskId, commentId, userId, content);
    if (!updated) throw ApiError.notFound('Comment not found or unauthorized');
    return updated;
  },

  async deleteComment(orgId: string, taskId: string, commentId: string) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');
    const deleted = await taskRepository.deleteComment(taskId, commentId);
    if (!deleted) throw ApiError.notFound('Comment not found');
  },

  async uploadAttachment(
    orgId: string,
    taskId: string,
    userId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');

    const storageKey = `${orgId}/${taskId}/${crypto.randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const stored = await storageService.uploadFile(storageKey, file.buffer, file.mimetype);

    const record = await taskRepository.addAttachment({
      taskId,
      uploadedBy: userId,
      fileName: file.originalname,
      fileSize: stored.size,
      mimeType: file.mimetype,
      storageKey: stored.storageKey,
    });

    return {
      ...record,
      downloadUrl: storageService.generatePresignedUrl(stored.storageKey),
    };
  },

  async addWatcher(orgId: string, taskId: string, userId: string) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');
    await taskRepository.addWatcher(taskId, userId);
    return taskRepository.findWatchers(taskId);
  },

  async removeWatcher(orgId: string, taskId: string, userId: string) {
    const task = await taskRepository.findByIdInOrg(orgId, taskId);
    if (!task) throw ApiError.notFound('Task not found');
    await taskRepository.removeWatcher(taskId, userId);
  },
};
