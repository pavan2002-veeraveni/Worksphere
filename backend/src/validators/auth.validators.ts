import { z } from 'zod';

export const SIGNUP_ALLOWED_ROLES = ['owner', 'project_manager'] as const;
export const LOGIN_ALLOWED_ROLES = [
  'platform_admin',
  'owner',
  'project_manager',
  'team_member',
  'auditor',
] as const;

export const registerSchema = z.object({
  email: z.string().email('Valid email address is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one digit'),
  role: z
    .enum(SIGNUP_ALLOWED_ROLES, {
      errorMap: () => ({
        message: 'Signup role must be Organization Owner or Project Manager',
      }),
    })
    .optional(),
  firstName: z.string().trim().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(100).optional(),
  organizationName: z.string().trim().min(2, 'Organization name must be at least 2 characters').max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
  role: z
    .enum(LOGIN_ALLOWED_ROLES, {
      errorMap: () => ({
        message: 'Invalid portal role selected',
      }),
    })
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
