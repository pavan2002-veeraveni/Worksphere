'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getStoredTokens } from '@/lib/auth';
import { ROLE_METADATA, ROLE_ORDER } from '@/lib/roles';
import type { LoginRole } from '@/types';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens) {
      router.replace('/login');
      return;
    }
    const storedRole = localStorage.getItem('active_role') as LoginRole | null;
    const target =
      storedRole && ROLE_ORDER.includes(storedRole)
        ? ROLE_METADATA[storedRole].defaultRoute
        : '/dashboard';
    router.replace(target);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner label="Redirecting to WorkSphere..." />
    </div>
  );
}
