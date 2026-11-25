import crypto from 'crypto';
import { getDb } from '../config/database';
import { enqueueJob, QUEUE_NAMES } from '../jobs/queue';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'is_set';
  value?: unknown;
}

interface Action {
  type: 'change_status' | 'assign_to' | 'send_notification' | 'create_subtask' | 'trigger_webhook';
  params: Record<string, unknown>;
}

interface WorkflowContext {
  orgId: string;
  projectId?: string;
  task?: Record<string, unknown>;
  actorId: string;
}

function matchesConditions(conditions: Condition[], context: WorkflowContext): boolean {
  const task = context.task || {};
  for (const cond of conditions) {
    const actual = task[cond.field] ?? task[camelToSnake(cond.field)];
    switch (cond.operator) {
      case 'equals':
        if (actual !== cond.value) return false;
        break;
      case 'not_equals':
        if (actual === cond.value) return false;
        break;
      case 'in':
        if (!Array.isArray(cond.value) || !cond.value.includes(actual)) return false;
        break;
      case 'is_set':
        if (actual === null || actual === undefined || actual === '') return false;
        break;
    }
  }
  return true;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

export const workflowEngine = {
  async evaluateRules(orgId: string, event: string, context: WorkflowContext): Promise<number> {
    const db = getDb();
    const rules = await db('workflow_rules')
      .where({ org_id: orgId, trigger_event: event, is_active: true })
      .andWhere((qb) => {
        qb.whereNull('project_id');
        if (context.projectId) {
          qb.orWhere('project_id', context.projectId);
        }
      });

    let executedCount = 0;
    for (const rule of rules) {
      const conditions: Condition[] = Array.isArray(rule.conditions)
        ? rule.conditions
        : JSON.parse(rule.conditions || '[]');
      const actions: Action[] = Array.isArray(rule.actions)
        ? rule.actions
        : JSON.parse(rule.actions || '[]');

      if (!matchesConditions(conditions, context)) continue;

      await this.executeActions(rule.id, actions, context);
      executedCount += 1;
    }

    // Also enqueue matching outgoing webhooks
    const webhooks = await db('outgoing_webhooks')
      .where({ org_id: orgId, is_active: true })
      .whereRaw('? = ANY(events)', [event]);

    for (const hook of webhooks) {
      const deliveryId = `del_${crypto.randomUUID()}`;
      await enqueueJob(QUEUE_NAMES.WEBHOOK, event, {
        deliveryId,
        webhookId: hook.id,
        orgId,
        url: hook.url,
        secret: hook.secret,
        eventType: event,
        payload: context.task || { projectId: context.projectId, actorId: context.actorId },
      });
    }

    return executedCount;
  },

  async executeActions(ruleId: string, actions: Action[], context: WorkflowContext): Promise<void> {
    const db = getDb();
    const taskId = context.task?.id ? String(context.task.id) : undefined;

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'change_status':
            if (taskId && typeof action.params.status === 'string') {
              await db('tasks')
                .where({ id: taskId })
                .update({
                  status: action.params.status,
                  version: db.raw('version + 1'),
                  updated_at: db.fn.now(),
                });
            }
            break;

          case 'assign_to':
            if (taskId && typeof action.params.userId === 'string') {
              await db('tasks')
                .where({ id: taskId })
                .update({
                  assignee_id: action.params.userId,
                  version: db.raw('version + 1'),
                  updated_at: db.fn.now(),
                });
            }
            break;

          case 'send_notification': {
            const targetUser =
              (action.params.userId as string | undefined) ||
              (context.task?.assignee_id as string | undefined) ||
              context.actorId;
            if (targetUser) {
              await notificationService.enqueueIdempotentNotification({
                idempotencyParts: ['workflow', ruleId, taskId || 'org', String(context.task?.version || 1)],
                orgId: context.orgId,
                userId: targetUser,
                type: 'task_updated',
                title: String(action.params.title || 'Workflow Rule Triggered'),
                message: String(action.params.message || 'An automated workflow rule ran on your task.'),
                link: context.projectId ? `/projects/${context.projectId}` : undefined,
              });
            }
            break;
          }

          case 'create_subtask':
            if (taskId && context.projectId && typeof action.params.title === 'string') {
              await db('tasks').insert({
                project_id: context.projectId,
                parent_task_id: taskId,
                title: action.params.title,
                status: 'todo',
                priority: String(action.params.priority || 'medium'),
                reporter_id: context.actorId,
              });
            }
            break;

          case 'trigger_webhook':
            // Handled via outgoing_webhooks subscription dispatch
            break;
        }
      } catch (err) {
        logger.error('Workflow action execution failed', {
          ruleId,
          actionType: action.type,
          error: (err as Error).message,
        });
      }
    }
  },
};
