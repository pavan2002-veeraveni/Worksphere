import { z } from 'zod';

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']);
export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Valid projectId is required'),
  milestoneId: z.string().uuid().nullable().optional(),
  parentTaskId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, 'Task title is required').max(500),
  description: z.string().max(10000).nullable().optional(),
  status: taskStatusSchema.default('todo'),
  priority: prioritySchema.default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  actualHours: z.number().nonnegative().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateTaskSchema = z.object({
  milestoneId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  actualHours: z.number().nonnegative().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  version: z.number().int().positive('version is required for optimistic locking'),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required').max(5000),
  parentCommentId: z.string().uuid().nullable().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment content is required').max(5000),
});
