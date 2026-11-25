import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import LoginPage from '@/app/(auth)/login/page';
import RegisterPage from '@/app/(auth)/register/page';
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
const mockedRegister = authLib.register as jest.MockedFunction<typeof authLib.register>;

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

const MULTI_ORG_OWNER: User = {
  id: 'user-carol',
  email: 'carol@acme.com',
  firstName: 'Carol',
  lastName: 'Martinez',
  avatarUrl: null,
  isPlatformAdmin: false,
  isActive: true,
  organizations: [
    { id: 'org-acme', name: 'Acme Corp', slug: 'acme-corp', plan: 'professional', role: 'owner' },
    { id: 'org-globex', name: 'Globex Inc', slug: 'globex-inc', plan: 'enterprise', role: 'owner' },
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

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={qc}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('Role-Based Login & Signup Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(clearAuth());
    localStorage.clear();
  });

  it('renders Owner, PM, Platform Admin, Team Member, and Auditor options without placeholders and validates input', async () => {
    renderWithProviders(<LoginPage />);

    const roleSelect = screen.getByLabelText('Role') as HTMLSelectElement;
    expect(roleSelect.value).toBe('owner');
    expect(screen.getByRole('option', { name: 'Organization Owner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project Manager' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Platform Admin' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Team Member' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Auditor' })).toBeInTheDocument();

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(emailInput.placeholder).toBe('');
    expect(passwordInput.placeholder).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Organization Owner' }));
    expect(await screen.findByText('Valid email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mockedLogin).not.toHaveBeenCalled();
  });

  it('auto-fills default Platform Admin credentials and signs into /admin console', async () => {
    mockedLogin.mockResolvedValueOnce({ user: ADMIN_USER, tokens: TOKENS });
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'platform_admin' } });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('admin@worksphere.io');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('Password123!');

    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Platform Admin' }));

    await waitFor(() =>
      expect(mockedLogin).toHaveBeenCalledWith(
        'admin@worksphere.io',
        'Password123!',
        'platform_admin',
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/admin'));
    expect(store.getState().auth.activeRole).toBe('platform_admin');
  });

  it('clears default admin credentials when switching to another role', () => {
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'platform_admin' } });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('admin@worksphere.io');

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'team_member' } });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });

  it('signs multi-role user into Auditor or Team Member workspace when selected', async () => {
    mockedLogin.mockResolvedValueOnce({ user: ALICE_MULTI_ROLE, tokens: TOKENS });
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'auditor' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Auditor' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/audit-logs'));
    expect(store.getState().auth.activeRole).toBe('auditor');
    expect(store.getState().auth.currentOrg?.id).toBe('org-globex');
  });

  it('presents workspace picker when owner holds multiple organizations', async () => {
    mockedLogin.mockResolvedValueOnce({ user: MULTI_ORG_OWNER, tokens: TOKENS });
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'carol@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Organization Owner' }));

    expect(await screen.findByRole('heading', { name: 'Choose Role & Workspace' })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Acme Corp'));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    expect(store.getState().auth.activeRole).toBe('owner');
    expect(store.getState().auth.currentOrg?.id).toBe('org-acme');
  });

  it('denies access, revokes session, and suggests held role on mismatch', async () => {
    mockedLogin.mockResolvedValueOnce({ user: BOB_MEMBER, tokens: TOKENS });
    renderWithProviders(<LoginPage />);

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
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@acme.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In as Organization Owner' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('keeps signup strictly limited to Organization Owner and Project Manager without first/last name fields', async () => {
    mockedRegister.mockResolvedValueOnce({
      user: {
        id: 'user-pm-new',
        email: 'newpm@company.com',
        firstName: 'Newpm',
        lastName: 'Manager',
        avatarUrl: null,
        isPlatformAdmin: false,
        isActive: true,
        organizations: [
          {
            id: 'org-new',
            name: "Newpm's Workspace",
            slug: 'newpm-workspace-1234',
            plan: 'free',
            role: 'project_manager',
          },
        ],
      },
      tokens: TOKENS,
    });

    renderWithProviders(<RegisterPage />);

    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/last name/i)).not.toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Organization Owner' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Project Manager' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Platform Admin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Team Member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Auditor' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'project_manager' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newpm@company.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Account as Project Manager' }));

    await waitFor(() =>
      expect(mockedRegister).toHaveBeenCalledWith({
        email: 'newpm@company.com',
        password: 'Password123!',
        role: 'project_manager',
      }),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects'));
    expect(store.getState().auth.activeRole).toBe('project_manager');
  });
});
