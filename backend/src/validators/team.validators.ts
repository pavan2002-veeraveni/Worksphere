import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required').max(255),
  description: z.string().max(2000).nullable().optional(),
});

export const updateTeamSchema = createTeamSchema.partial();

export const addTeamMemberSchema = z.object({
  userId: z.string().uuid('Valid userId is required'),
  role: z.enum(['lead', 'member']).default('member'),
});
