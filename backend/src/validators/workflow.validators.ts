import { z } from 'zod';

export const createWorkflowRuleSchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1, 'Rule name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  triggerEvent: z.enum([
    'task.created',
    'task.status_changed',
    'task.assigned',
    'task.overdue',
    'comment.created',
  ]),
  conditions: z
    .array(
      z.object({
        field: z.enum(['status', 'priority', 'assigneeId']),
        operator: z.enum(['equals', 'not_equals', 'in', 'is_set']),
        value: z.unknown().optional(),
      }),
    )
    .default([]),
  actions: z
    .array(
      z.object({
        type: z.enum(['change_status', 'assign_to', 'send_notification', 'create_subtask', 'trigger_webhook']),
        params: z.record(z.unknown()).default({}),
      }),
    )
    .min(1, 'At least one workflow action is required'),
  isActive: z.boolean().default(true),
});

export const updateWorkflowRuleSchema = createWorkflowRuleSchema.partial();
