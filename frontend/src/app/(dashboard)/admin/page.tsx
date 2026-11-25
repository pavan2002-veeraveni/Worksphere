'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ShieldAlert } from 'lucide-react';
import { get } from '@/lib/api';
import type { RootState } from '@/store/store';

export default function PlatformAdminPage() {
  const user = useSelector((s: RootState) => s.auth.user);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () =>
      (await get<{ organizations: number; users: number; projects: number; tasks: number }>('/admin/stats')).data,
    enabled: Boolean(user?.isPlatformAdmin),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['adminOrgs'],
    queryFn: async () =>
      (await get<Array<{ id: string; name: string; slug: string; plan: string; member_count: string }>>('/admin/organizations')).data || [],
    enabled: Boolean(user?.isPlatformAdmin),
  });

  if (!user?.isPlatformAdmin) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-6 w-6" />}
        title="Platform Administrator Access Required"
        description="This area is restricted to WorkSphere platform administrators."
      />
    );
  }

  if (isLoading) return <LoadingSpinner label="Loading platform telemetry..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Platform Administration</h1>
        <p className="text-sm text-secondary-500">Global tenant overview across WorkSphere.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card title="Organizations"><p className="text-2xl font-bold">{stats?.organizations ?? 0}</p></Card>
        <Card title="Total Users"><p className="text-2xl font-bold">{stats?.users ?? 0}</p></Card>
        <Card title="Total Projects"><p className="text-2xl font-bold">{stats?.projects ?? 0}</p></Card>
        <Card title="Total Tasks"><p className="text-2xl font-bold">{stats?.tasks ?? 0}</p></Card>
      </div>

      <Card title="Tenant Organizations">
        <div className="divide-y divide-secondary-100">
          {orgs.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-semibold text-secondary-900">{o.name}</p>
                <p className="text-xs text-secondary-500">Slug: {o.slug} • {o.member_count} members</p>
              </div>
              <Badge variant="info">{o.plan}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
