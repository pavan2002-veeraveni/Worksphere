import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { LoginRole, User, UserOrgMembership } from '@/types';

interface AuthState {
  user: User | null;
  currentOrg: UserOrgMembership | null;
  activeRole: LoginRole | null;
  isAuthenticated: boolean;
}

const VALID_ROLES: LoginRole[] = [
  'platform_admin',
  'owner',
  'project_manager',
  'team_member',
  'auditor',
];

function readStoredRole(): LoginRole | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('active_role');
  return raw && VALID_ROLES.includes(raw as LoginRole) ? (raw as LoginRole) : null;
}

function persistSessionMeta(orgId: string | null, role: LoginRole | null) {
  if (typeof window === 'undefined') return;
  if (orgId) {
    localStorage.setItem('current_org_id', orgId);
  } else {
    localStorage.removeItem('current_org_id');
  }
  if (role) {
    localStorage.setItem('active_role', role);
  } else {
    localStorage.removeItem('active_role');
  }
}

const initialState: AuthState = {
  user: null,
  currentOrg: null,
  activeRole: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthSession(
      state,
      action: PayloadAction<{
        user: User;
        currentOrg: UserOrgMembership | null;
        activeRole: LoginRole;
      }>,
    ) {
      state.user = action.payload.user;
      state.currentOrg = action.payload.currentOrg;
      state.activeRole = action.payload.activeRole;
      state.isAuthenticated = true;
      persistSessionMeta(action.payload.currentOrg?.id ?? null, action.payload.activeRole);
    },
    setUser(state, action: PayloadAction<User | null>) {
      const user = action.payload;
      state.user = user;
      state.isAuthenticated = Boolean(user);

      if (!user) {
        state.currentOrg = null;
        state.activeRole = null;
        return;
      }

      const orgs = user.organizations || [];
      let resolvedOrg = state.currentOrg
        ? orgs.find((o) => o.id === state.currentOrg?.id) || null
        : null;

      if (!resolvedOrg && orgs.length > 0) {
        const storedOrgId =
          typeof window !== 'undefined' ? localStorage.getItem('current_org_id') : null;
        resolvedOrg = orgs.find((o) => o.id === storedOrgId) || orgs[0];
      }
      state.currentOrg = resolvedOrg;

      const storedRole = state.activeRole || readStoredRole();
      let resolvedRole: LoginRole;
      if (storedRole === 'platform_admin' && user.isPlatformAdmin) {
        resolvedRole = 'platform_admin';
      } else if (resolvedOrg) {
        resolvedRole = resolvedOrg.role;
      } else if (user.isPlatformAdmin) {
        resolvedRole = 'platform_admin';
      } else {
        resolvedRole = 'team_member';
      }

      state.activeRole = resolvedRole;
      persistSessionMeta(resolvedOrg?.id ?? null, resolvedRole);
    },
    setCurrentOrg(state, action: PayloadAction<UserOrgMembership | null>) {
      state.currentOrg = action.payload;
      const nextRole: LoginRole | null = action.payload
        ? action.payload.role
        : state.user?.isPlatformAdmin
          ? 'platform_admin'
          : null;
      state.activeRole = nextRole;
      persistSessionMeta(action.payload?.id ?? null, nextRole);
    },
    setActiveRole(state, action: PayloadAction<LoginRole | null>) {
      state.activeRole = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('active_role', action.payload);
        } else {
          localStorage.removeItem('active_role');
        }
      }
    },
    clearAuth(state) {
      state.user = null;
      state.currentOrg = null;
      state.activeRole = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_tokens');
        localStorage.removeItem('current_org_id');
        localStorage.removeItem('active_role');
      }
    },
  },
});

export const { setAuthSession, setUser, setCurrentOrg, setActiveRole, clearAuth } =
  authSlice.actions;
export default authSlice.reducer;
