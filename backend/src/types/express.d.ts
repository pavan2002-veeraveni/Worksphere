export type OrgRole = 'owner' | 'project_manager' | 'team_member' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
}

export interface TenantContext {
  orgId: string;
  role: OrgRole | 'platform_admin';
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: AuthUser;
      tenant?: TenantContext;
    }
  }
}

export {};
