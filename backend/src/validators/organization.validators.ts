import { z } from 'zod';

export const orgRoleSchema = z.enum(['owner', 'project_manager', 'team_member', 'auditor']);

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(255),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .optional(),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  plan: z.enum(['free', 'starter', 'professional', 'enterprise']).optional(),
  logoUrl: z.string().url().nullable().optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: orgRoleSchema.default('team_member'),
});

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});
