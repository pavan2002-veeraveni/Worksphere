import { z } from 'zod';

export const projectStatusSchema = z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']);
export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1, 'Project name is required').max(255),
    description: z.string().max(5000).nullable().optional(),
    status: projectStatusSchema.default('planning'),
    priority: prioritySchema.default('medium'),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate),
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  );

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().max(5000).nullable().optional(),
    status: projectStatusSchema.optional(),
    priority: prioritySchema.optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    settings: z.record(z.unknown()).optional(),
    version: z.number().int().positive('Expected version is required for concurrent-safe updates'),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate),
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  );

export const createMilestoneSchema = z.object({
  name: z.string().trim().min(1, 'Milestone name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).default('pending'),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateMilestoneSchema = createMilestoneSchema.partial();
