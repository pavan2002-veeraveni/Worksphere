import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User, UserOrgMembership } from '@/types';

interface AuthState {
  user: User | null;
  currentOrg: UserOrgMembership | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  currentOrg: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      if (action.payload?.organizations && action.payload.organizations.length > 0 && !state.currentOrg) {
        const storedOrgId = typeof window !== 'undefined' ? localStorage.getItem('current_org_id') : null;
        const matched =
          action.payload.organizations.find((o) => o.id === storedOrgId) ||
          action.payload.organizations[0];
        state.currentOrg = matched;
        if (typeof window !== 'undefined') {
          localStorage.setItem('current_org_id', matched.id);
        }
      }
    },
    setCurrentOrg(state, action: PayloadAction<UserOrgMembership | null>) {
      state.currentOrg = action.payload;
      if (typeof window !== 'undefined') {
        if (action.payload) {
          localStorage.setItem('current_org_id', action.payload.id);
        } else {
          localStorage.removeItem('current_org_id');
        }
      }
    },
    clearAuth(state) {
      state.user = null;
      state.currentOrg = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_tokens');
        localStorage.removeItem('current_org_id');
      }
    },
  },
});

export const { setUser, setCurrentOrg, clearAuth } = authSlice.actions;
export default authSlice.reducer;
