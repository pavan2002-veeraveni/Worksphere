'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Crown, Eye, EyeOff, FolderKanban } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { useRegister } from '@/hooks/useAuth';
import {
  ROLE_METADATA,
  resolvePostLoginDestination,
  SIGNUP_ROLE_ORDER,
  SignupRole,
} from '@/lib/roles';

const registerSchema = z
  .object({
    role: z.enum(['owner', 'project_manager'], {
      errorMap: () => ({
        message: 'Access is restricted to Organization Owner and Project Manager roles',
      }),
    }),
    email: z.string().email('Valid email is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/[0-9]/, 'Password must include a number'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterValues = z.infer<typeof registerSchema>;

const SIGNUP_ROLE_OPTIONS: SelectOption[] = SIGNUP_ROLE_ORDER.map((r) => ({
  value: r,
  label: ROLE_METADATA[r].label,
}));

const SIGNUP_ROLE_ICONS: Record<SignupRole, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  project_manager: FolderKanban,
};

export default function RegisterPage() {
  const router = useRouter();
  const { mutateAsync: registerUser, isPending } = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'owner',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const selectedRole = watch('role');
  const activeMeta = ROLE_METADATA[selectedRole];
  const RoleIcon = SIGNUP_ROLE_ICONS[selectedRole];

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null);
    try {
      const { user } = await registerUser({
        email: values.email.trim(),
        password: values.password,
        role: values.role,
      });
      const destination = resolvePostLoginDestination(values.role, user);
      router.push(destination);
    } catch (err) {
      setServerError((err as Error).message || 'Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-secondary-900">Create your account</h2>
        <p className="mt-0.5 text-xs text-secondary-500">
          Role-based signup is enabled for Organization Owner and Project Manager workspaces.
        </p>
      </div>

      {serverError && (
        <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
          {serverError}
        </div>
      )}

      <div className="space-y-2.5">
        <Select
          label="Role"
          options={SIGNUP_ROLE_OPTIONS}
          error={errors.role?.message}
          {...register('role')}
        />

        <div className="rounded-xl border border-secondary-200 bg-secondary-50/80 p-3 text-xs">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 font-semibold text-secondary-900">
              <RoleIcon className="h-4 w-4 text-primary-600" />
              <span>{activeMeta.label} Access</span>
            </div>
            <Badge variant={activeMeta.badgeVariant}>{activeMeta.shortLabel}</Badge>
          </div>
          <p className="mt-1 text-secondary-600">{activeMeta.description}</p>
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
        autoComplete="new-password"
        helperText="At least 8 characters with uppercase, lowercase, and a number"
        error={errors.password?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="text-secondary-400 hover:text-secondary-600"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...register('password')}
      />

      <Input
        type={showConfirmPassword ? 'text' : 'password'}
        label="Confirm Password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowConfirmPassword((p) => !p)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            className="text-secondary-400 hover:text-secondary-600"
          >
            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...register('confirmPassword')}
      />

      <Button type="submit" fullWidth loading={isPending}>
        Create Account as {activeMeta.label}
      </Button>

      <p className="text-center text-xs text-secondary-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
