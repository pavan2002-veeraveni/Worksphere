'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getStoredTokens } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const tokens = getStoredTokens();
    router.replace(tokens ? '/dashboard' : '/login');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner label="Redirecting to WorkSphere..." />
    </div>
  );
}
