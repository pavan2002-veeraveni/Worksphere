'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckSquare,
  Crown,
  Eye,
  EyeOff,
  FolderKanban,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { useCommitRoleSession, useLogin, useLogout } from '@/hooks/useAuth';
import {
  DEFAULT_PLATFORM_ADMIN_CREDENTIALS,
  PORTAL_ROLE_ORDER,
  PortalLoginRole,
  resolvePostLoginDestination,
  resolveRoleLogin,
  ROLE_METADATA,
  WorkspaceRoleOption,
} from '@/lib/roles';
import type { LoginRole, User } from '@/types';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

const ROLE_ICONS: Record<PortalLoginRole, React.ComponentType<{ className?: string }>> = {
  platform_admin: ShieldAlert,
  owner: Crown,
  project_manager: FolderKanban,
  team_member: CheckSquare,
  auditor: ShieldCheck,
};

const ROLE_SELECT_OPTIONS: SelectOption[] = PORTAL_ROLE_ORDER.map((r) => ({
  value: r,
  label: ROLE_METADATA[r].label,
}));

export default function LoginPage() {
  const router = useRouter();
  const { mutateAsync: login, isPending } = useLogin();
  const { mutateAsync: logout } = useLogout();
  const commitRoleSession = useCommitRoleSession();

  const [selectedRole, setSelectedRole] = useState<PortalLoginRole>('owner');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestedRoles, setSuggestedRoles] = useState<LoginRole[]>([]);
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceRoleOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const applyRoleSelection = (role: PortalLoginRole) => {
    setSelectedRole(role);
    setServerError(null);
    setSuggestedRoles([]);
    clearErrors();

    if (role === 'platform_admin') {
      setValue('email', DEFAULT_PLATFORM_ADMIN_CREDENTIALS.email, { shouldValidate: false });
      setValue('password', DEFAULT_PLATFORM_ADMIN_CREDENTIALS.password, { shouldValidate: false });
    } else if (
      getValues('email') === DEFAULT_PLATFORM_ADMIN_CREDENTIALS.email &&
      getValues('password') === DEFAULT_PLATFORM_ADMIN_CREDENTIALS.password
    ) {
      setValue('email', '', { shouldValidate: false });
      setValue('password', '', { shouldValidate: false });
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roleParam = params.get('role');
    if (roleParam && PORTAL_ROLE_ORDER.includes(roleParam as PortalLoginRole)) {
      const nextRole = roleParam as PortalLoginRole;
      setSelectedRole(nextRole);
      if (nextRole === 'platform_admin') {
        setValue('email', DEFAULT_PLATFORM_ADMIN_CREDENTIALS.email, { shouldValidate: false });
        setValue('password', DEFAULT_PLATFORM_ADMIN_CREDENTIALS.password, { shouldValidate: false });
      }
    }
  }, [setValue]);

  const getNextQueryParam = (): string | null => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('next');
  };

  const finalizeSession = (option: {
    user: User;
    activeRole: LoginRole;
    org: WorkspaceRoleOption['org'];
  }) => {
    commitRoleSession({
      user: option.user,
      currentOrg: option.org,
      activeRole: option.activeRole,
    });
    const destination = resolvePostLoginDestination(
      option.activeRole,
      option.user,
      getNextQueryParam(),
    );
    router.push(destination);
  };

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    setSuggestedRoles([]);

    try {
      const { user } = await login({
        email: values.email.trim(),
        password: values.password,
        role: selectedRole,
      });

      const resolution = resolveRoleLogin(user, selectedRole);

      if (resolution.status === 'role_mismatch') {
        await logout().catch(() => undefined);
        setServerError(resolution.error);
        setSuggestedRoles(resolution.availableRoles);
        return;
      }

      if (resolution.status === 'select_workspace') {
        setVerifiedUser(user);
        setWorkspaceOptions(resolution.options);
        return;
      }

      finalizeSession({
        user,
        activeRole: resolution.activeRole,
        org: resolution.org,
      });
    } catch (err) {
      setServerError((err as Error).message || 'Invalid email or password');
    }
  };

  const handleCancelWorkspaceStep = async () => {
    await logout().catch(() => undefined);
    setVerifiedUser(null);
    setWorkspaceOptions([]);
    setServerError(null);
    setSuggestedRoles([]);
  };

  if (verifiedUser && workspaceOptions.length > 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-secondary-900">Choose Role & Workspace</h2>
          <p className="mt-1 text-xs text-secondary-500">
            Signed in as{' '}
            <span className="font-medium text-secondary-800">{verifiedUser.email}</span>. Select a
            workspace portal to continue:
          </p>
        </div>

        <div className="space-y-2.5">
          {workspaceOptions.map((option) => {
            const meta = ROLE_METADATA[option.role];
            const Icon = ROLE_ICONS[(option.role as PortalLoginRole)] || Building2;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() =>
                  finalizeSession({
                    user: verifiedUser,
                    activeRole: option.role,
                    org: option.org,
                  })
                }
                className="group flex w-full items-center justify-between rounded-xl border border-secondary-200 bg-white p-3.5 text-left transition hover:border-primary-400 hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100">
                    {option.org ? <Building2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-secondary-900">
                        {option.title}
                      </span>
                      <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-secondary-500">{option.subtitle}</p>
                  </div>
                </div>
                <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-secondary-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="ghost"
          fullWidth
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={handleCancelWorkspaceStep}
        >
          Use a different account
        </Button>
      </div>
    );
  }

  const activeMeta = ROLE_METADATA[selectedRole];
  const ActiveRoleIcon = ROLE_ICONS[selectedRole];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-secondary-900">Sign in to your account</h2>
        <p className="mt-0.5 text-xs text-secondary-500">
          Choose your portal role to sign in to your workspace.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="space-y-2 rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700"
        >
          <p>{serverError}</p>
          {suggestedRoles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="font-medium text-danger-800">Authorized roles for this account:</span>
              {suggestedRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => applyRoleSelection(role as PortalLoginRole)}
                  className="rounded-md border border-danger-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-danger-800 hover:bg-danger-100"
                >
                  Switch to {ROLE_METADATA[role].label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Role portal selector */}
      <div className="space-y-2.5">
        <Select
          label="Role"
          value={selectedRole}
          onChange={(e) => applyRoleSelection(e.target.value as PortalLoginRole)}
          options={ROLE_SELECT_OPTIONS}
        />

        <div className="rounded-xl border border-secondary-200 bg-secondary-50/80 p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-secondary-900">
              <ActiveRoleIcon className="h-4 w-4 text-primary-600" />
              <span>{activeMeta.label} Portal</span>
            </div>
            <Badge variant={activeMeta.badgeVariant}>{activeMeta.shortLabel}</Badge>
          </div>
          <p className="mt-1 text-secondary-600">{activeMeta.description}</p>
          {selectedRole === 'platform_admin' && (
            <p className="mt-1.5 font-medium text-primary-700">
              Default Platform Admin credentials are pre-filled ({DEFAULT_PLATFORM_ADMIN_CREDENTIALS.email}).
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeMeta.permissions.map((perm) => (
              <span
                key={perm}
                className="rounded-md border border-secondary-200 bg-white px-2 py-0.5 text-[11px] font-medium text-secondary-700"
              >
                {perm}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Input
        type="email"
        label="Email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        type={showPassword ? 'text' : 'password'}
        label="Password"
        autoComplete="current-password"
        error={errors.password?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="text-secondary-400 hover:text-secondary-600 focus:outline-none"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...register('password')}
      />

      <Button type="submit" fullWidth loading={isPending}>
        Sign In as {activeMeta.label}
      </Button>

      <p className="text-center text-xs text-secondary-500">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-primary-600 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
