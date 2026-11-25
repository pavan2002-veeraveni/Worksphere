'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { mutateAsync: login, isPending } = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      await login(values);
      router.push('/dashboard');
    } catch (err) {
      setServerError((err as Error).message || 'Invalid credentials');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <h2 className="text-lg font-semibold text-secondary-900">Sign in to your account</h2>

      {serverError && (
        <div role="alert" className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
          {serverError}
        </div>
      )}

      <Input
        type="email"
        label="Email"
        placeholder="alice@acme.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        type="password"
        label="Password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      <Button type="submit" fullWidth loading={isPending}>
        Sign In
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
