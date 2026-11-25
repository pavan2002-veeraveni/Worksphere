import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import LoginPage from '@/app/(auth)/login/page';
import { ToastProvider } from '@/components/ui/Toast';
import * as authLib from '@/lib/auth';
import { store } from '@/store/store';
import { clearAuth } from '@/store/slices/authSlice';
import type { AuthTokens, User } from '@/types';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock('@/lib/auth', () => ({
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  getStoredTokens: jest.fn(() => null),
  clearStoredTokens: jest.fn(),
  register: jest.fn(),
  getCurrentUser: jest.fn(),
}));

const mockedLogin = authLib.login as jest.MockedFunction<typeof authLib.login>;
const mockedLogout = authLib.logout as jest.MockedFunction<typeof authLib.logout>;

const TOKENS: AuthTokens = {
  accessToken: 'access-123',
  refreshToken: 'refresh-123',
};

const ALICE_MULTI_ROLE: User = {
  id: 'user-alice',
  email: 'alice@acme.com',
  firstName: 'Alice',
  lastName: 'Johnson',
  avatarUrl: null,
  isPlatformAdmin: false,
  isActive: true,
  organizations: [
    { id: 'org-acme', name: 'Acme Corp', slug: 'acme-corp', plan: 'professional', role: 'project_manager' },
    { id: 'org-globex', name: 'Globex Inc', slug: 'globex-inc', plan: 'enterprise', role: 'auditor' },
  ],
};

const ADMIN_USER: User = {
  id: 'user-admin',
  email: 'admin@worksphere.io',
  firstName: 'Platform',
  lastName: 'Admin',
  avatarUrl: null,
  isPlatformAdmin: true,
  isActive: true,
  organizations: [
    { id: 'org-acme', name: 'Acme Corp', slug: 'acme-corp', plan: 'professional', role: 'owner' },
  ],
};

const BOB_MEMBER: User = {
  id: 'user-bob',
  email: 'bob@acme.com',
  firstName: 'Bob',
  lastName: 'Williams',
  avatarUrl: null,
  isPlatformAdmin: false,
  isActive: true,
  organizations: [
    { id: 'org-acme', name: 'Acme Corp', slug: 'acme-corp', plan: 'professional', role: 'team_member' },
  ],
};

function renderLoginPage() {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <LoginPage />
        </ToastProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('Role-Based Login Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(clearAuth());
    localStorage.clear();
  });

  it('renders role dropdown options and validates invalid input', async () => {
    renderLoginPage();

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    expect(roleSelect.value).toBe('auto');
    expect(screen.getByRole('option', { name: 'Auto-Detect (All Roles)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Platform Admin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Organization Owner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project Manager' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Team Member' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Auditor' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Valid email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('signs multi-role user directly into matching organization when explicit role selected', async () => {
    mockedLogin.mockResolvedValueOnce({ user: ALICE_MULTI_ROLE, tokens: TOKENS });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'auditor' } });
    expect(screen.getByRole('button', { name: 'Sign In as Auditor' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Auditor' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/audit-logs'));
    expect(store.getState().auth.activeRole).toBe('auditor');
    expect(store.getState().auth.currentOrg?.id).toBe('org-globex');
  });

  it('signs platform admin into /admin console when Platform Admin role is selected', async () => {
    mockedLogin.mockResolvedValueOnce({ user: ADMIN_USER, tokens: TOKENS });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'platform_admin' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@worksphere.io' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Platform Admin' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin'));
    expect(store.getState().auth.activeRole).toBe('platform_admin');
  });

  it('presents workspace & role picker on Auto-Detect when user holds multiple roles', async () => {
    mockedLogin.mockResolvedValueOnce({ user: ALICE_MULTI_ROLE, tokens: TOKENS });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('heading', { name: 'Choose Role & Workspace' })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Acme Corp'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects'));
    expect(store.getState().auth.activeRole).toBe('project_manager');
    expect(store.getState().auth.currentOrg?.id).toBe('org-acme');
  });

  it('denies access, revokes session, and suggests authorized role on role mismatch', async () => {
    mockedLogin.mockResolvedValueOnce({ user: BOB_MEMBER, tokens: TOKENS });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'auditor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Auditor' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Role verification failed: bob@acme.com does not hold the Auditor role in any organization.',
    );
    expect(mockedLogout).toHaveBeenCalledTimes(1);
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Team Member' }));
    expect((screen.getByLabelText('Role') as HTMLSelectElement).value).toBe('team_member');
  });

  it('displays safe authentication error on invalid credentials', async () => {
    mockedLogin.mockRejectedValueOnce(new Error('Invalid email or password'));
    renderLoginPage();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
