'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useCurrentUser } from '@/hooks/useAuth';
import { getStoredTokens } from '@/lib/auth';

export default function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasToken = typeof window !== 'undefined' && Boolean(getStoredTokens());
  const { isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (!hasToken || isError) {
      const target =
        pathname && pathname !== '/login' && pathname !== '/register'
          ? `/login?next=${encodeURIComponent(pathname)}`
          : '/login';
      router.replace(target);
    }
  }, [hasToken, isError, pathname, router]);

  if (!hasToken || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Loading workspace..." />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
