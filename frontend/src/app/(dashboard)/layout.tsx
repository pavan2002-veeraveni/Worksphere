'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useCurrentUser } from '@/hooks/useAuth';
import { getStoredTokens } from '@/lib/auth';

export default function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasToken = typeof window !== 'undefined' && Boolean(getStoredTokens());
  const { isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (!hasToken || isError) {
      router.replace('/login');
    }
  }, [hasToken, isError, router]);

  if (!hasToken || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Loading workspace..." />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
