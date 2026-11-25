import type { BadgeProps } from '@/components/ui/Badge';
import type { LoginRole, User, UserOrgMembership } from '@/types';

export type SignupRole = 'owner' | 'project_manager';
export type PortalLoginRole = 'platform_admin' | SignupRole;
export type RoleSelectionOption = PortalLoginRole;

export interface RoleMetadata {
  id: LoginRole;
  label: string;
  shortLabel: string;
  tagline: string;
  description: string;
  defaultRoute: string;
  badgeVariant: NonNullable<BadgeProps['variant']>;
  permissions: string[];
}

export const SIGNUP_ROLE_ORDER: SignupRole[] = ['owner', 'project_manager'];

export const PORTAL_ROLE_ORDER: PortalLoginRole[] = [
  'owner',
  'project_manager',
  'platform_admin',
];

export const ROLE_ORDER: LoginRole[] = PORTAL_ROLE_ORDER;

export const DEFAULT_PLATFORM_ADMIN_CREDENTIALS = {
  email: 'admin@worksphere.io',
  password: 'Password123!',
} as const;

export const ROLE_METADATA: Record<LoginRole, RoleMetadata> = {
  platform_admin: {
    id: 'platform_admin',
    label: 'Platform Admin',
    shortLabel: 'Admin',
    tagline: 'Global multi-tenant administration',
    description: 'Monitor all tenant organizations, platform health metrics, and global operations.',
    defaultRoute: '/admin',
    badgeVariant: 'danger',
    permissions: ['Global Tenants', 'Platform Telemetry', 'All Modules'],
  },
  owner: {
    id: 'owner',
    label: 'Organization Owner',
    shortLabel: 'Owner',
    tagline: 'Full workspace ownership & governance',
    description: 'Manage organization settings, member invitations, projects, workflows, and audit logs.',
    defaultRoute: '/dashboard',
    badgeVariant: 'info',
    permissions: ['Org Settings', 'Team Invites', 'Workflows', 'Audit Logs'],
  },
  project_manager: {
    id: 'project_manager',
    label: 'Project Manager',
    shortLabel: 'PM',
    tagline: 'Delivery planning, milestones & automation',
    description: 'Create and track projects, sprints, team assignments, tasks, and workflow rules.',
    defaultRoute: '/projects',
    badgeVariant: 'success',
    permissions: ['Projects & Milestones', 'Tasks & Boards', 'Workflows', 'Team Invites'],
  },
  team_member: {
    id: 'team_member',
    label: 'Team Member',
    shortLabel: 'Member',
    tagline: 'Task execution & team collaboration',
    description: 'Work on assigned tasks and subtasks, post updates, and track sprint deliverables.',
    defaultRoute: '/tasks',
    badgeVariant: 'default',
    permissions: ['Assigned Tasks', 'Task Comments', 'View Projects'],
  },
  auditor: {
    id: 'auditor',
    label: 'Auditor',
    shortLabel: 'Auditor',
    tagline: 'Compliance verification & immutable trails',
    description: 'Inspect organization audit logs, user actions, and read-only project analytics.',
    defaultRoute: '/audit-logs',
    badgeVariant: 'warning',
    permissions: ['Audit Logs', 'Compliance Review', 'Read-Only Metrics'],
  },
};

export interface WorkspaceRoleOption {
  key: string;
  role: LoginRole;
  org: UserOrgMembership | null;
  title: string;
  subtitle: string;
  redirectTo: string;
}

export type RoleLoginResolution =
  | {
      status: 'authorized';
      activeRole: LoginRole;
      org: UserOrgMembership | null;
      redirectTo: string;
    }
  | {
      status: 'select_workspace';
      options: WorkspaceRoleOption[];
    }
  | {
      status: 'role_mismatch';
      error: string;
      availableRoles: LoginRole[];
    };

/**
 * Collect distinct authorized portal roles held by the user across global and tenant memberships.
 */
export function getUserAvailableRoles(user: User): LoginRole[] {
  const roles = new Set<LoginRole>();
  if (user.isPlatformAdmin) {
    roles.add('platform_admin');
  }
  for (const org of user.organizations || []) {
    if (PORTAL_ROLE_ORDER.includes(org.role as PortalLoginRole)) {
      roles.add(org.role);
    }
  }
  return ROLE_ORDER.filter((r) => roles.has(r));
}

/**
 * Build selectable (role, workspace) session entries limited to authorized portal roles.
 */
export function buildWorkspaceRoleOptions(
  user: User,
  filterRole?: LoginRole,
): WorkspaceRoleOption[] {
  const options: WorkspaceRoleOption[] = [];

  if (user.isPlatformAdmin && (!filterRole || filterRole === 'platform_admin')) {
    const primaryOrg =
      (user.organizations || []).find((org) => org.role === 'owner' || org.role === 'project_manager') ||
      null;
    options.push({
      key: 'platform_admin:global',
      role: 'platform_admin',
      org: primaryOrg,
      title: 'WorkSphere Platform Console',
      subtitle: primaryOrg
        ? `Global administrator (default tenant: ${primaryOrg.name})`
        : 'Global multi-tenant administration',
      redirectTo: ROLE_METADATA.platform_admin.defaultRoute,
    });
  }

  for (const org of user.organizations || []) {
    if (org.role !== 'owner' && org.role !== 'project_manager') continue;
    if (filterRole && filterRole !== org.role) continue;
    const roleMeta = ROLE_METADATA[org.role];
    options.push({
      key: `${org.role}:${org.id}`,
      role: org.role,
      org,
      title: org.name,
      subtitle: `${org.plan} plan • ${roleMeta.tagline}`,
      redirectTo: roleMeta.defaultRoute,
    });
  }

  return options;
}

/**
 * Validate whether an authenticated user can sign in under the selected role portal
 * and determine whether to redirect immediately or present a workspace choice.
 */
export function resolveRoleLogin(
  user: User,
  selectedRole: LoginRole,
): RoleLoginResolution {
  const availableRoles = getUserAvailableRoles(user);

  if (!PORTAL_ROLE_ORDER.includes(selectedRole as PortalLoginRole)) {
    return {
      status: 'role_mismatch',
      error: 'Access is restricted to Platform Admin, Organization Owner, and Project Manager roles.',
      availableRoles,
    };
  }

  if (selectedRole === 'platform_admin') {
    if (!user.isPlatformAdmin) {
      return {
        status: 'role_mismatch',
        error: `Role verification failed: ${user.email} does not have Platform Admin privileges.`,
        availableRoles,
      };
    }
    const primaryOrg =
      (user.organizations || []).find((org) => org.role === 'owner' || org.role === 'project_manager') ||
      null;
    return {
      status: 'authorized',
      activeRole: 'platform_admin',
      org: primaryOrg,
      redirectTo: ROLE_METADATA.platform_admin.defaultRoute,
    };
  }

  const matchingOptions = buildWorkspaceRoleOptions(user, selectedRole);
  if (matchingOptions.length === 0) {
    const requestedLabel = ROLE_METADATA[selectedRole].label;
    return {
      status: 'role_mismatch',
      error: `Role verification failed: ${user.email} does not hold the ${requestedLabel} role in any organization.`,
      availableRoles,
    };
  }

  if (matchingOptions.length === 1) {
    return {
      status: 'authorized',
      activeRole: matchingOptions[0].role,
      org: matchingOptions[0].org,
      redirectTo: matchingOptions[0].redirectTo,
    };
  }

  return { status: 'select_workspace', options: matchingOptions };
}

/**
 * Determine the effective role for UI rendering and navigation guards.
 */
export function getEffectiveRole(
  user: User | null,
  currentOrg: UserOrgMembership | null,
  activeRole: LoginRole | null,
): LoginRole | null {
  if (!user) return null;
  if (activeRole === 'platform_admin' && user.isPlatformAdmin) {
    return 'platform_admin';
  }
  if (currentOrg && ROLE_ORDER.includes(currentOrg.role)) {
    return currentOrg.role;
  }
  if (user.isPlatformAdmin) {
    return 'platform_admin';
  }
  return activeRole && ROLE_ORDER.includes(activeRole) ? activeRole : null;
}

const ROUTE_ROLE_RULES: Array<{ prefix: string; roles: LoginRole[] }> = [
  { prefix: '/admin', roles: ['platform_admin'] },
  { prefix: '/workflows', roles: ['platform_admin', 'owner', 'project_manager'] },
  { prefix: '/audit-logs', roles: ['platform_admin', 'owner'] },
];

/**
 * Check whether the active role can access a dashboard route.
 */
export function canAccessRoute(
  pathname: string,
  effectiveRole: LoginRole | null,
  user: User | null,
): boolean {
  if (!user) return false;

  const matchedRule = ROUTE_ROLE_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`),
  );

  if (!matchedRule) {
    return true;
  }

  if (matchedRule.prefix === '/admin') {
    return Boolean(user.isPlatformAdmin);
  }

  if (!effectiveRole) return false;
  return matchedRule.roles.includes(effectiveRole);
}

/**
 * Resolve post-login destination respecting safe `next` redirects only when permitted for the role.
 */
export function resolvePostLoginDestination(
  activeRole: LoginRole,
  user: User,
  nextPath?: string | null,
): string {
  if (
    nextPath &&
    nextPath.startsWith('/') &&
    !nextPath.startsWith('//') &&
    nextPath !== '/login' &&
    nextPath !== '/register' &&
    canAccessRoute(nextPath, activeRole, user)
  ) {
    return nextPath;
  }
  return ROLE_METADATA[activeRole].defaultRoute;
}
