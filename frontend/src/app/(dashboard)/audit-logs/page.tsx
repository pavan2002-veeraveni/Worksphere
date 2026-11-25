'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { get } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import type { RootState } from '@/store/store';
import type { AuditEvent } from '@/types';

export default function AuditLogsPage() {
  const { currentOrg } = useSelector((s: RootState) => s.auth);
  const [page, setPage] = useState(1);

  const { data: res, isLoading } = useQuery({
    queryKey: ['auditLogs', currentOrg?.id, page],
    queryFn: async () => await get<AuditEvent[]>('/audit-log', { page, limit: 20 }),
    enabled: Boolean(currentOrg?.id),
  });

  if (isLoading) return <LoadingSpinner label="Loading immutable audit trail..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Audit Logs</h1>
        <p className="text-sm text-secondary-500">
          Compliance audit trail scoped to {currentOrg?.name}. Visible to Owners & Auditors.
        </p>
      </div>

      <DataTable
        data={res?.data || []}
        pagination={res?.meta}
        onPageChange={setPage}
        columns={[
          {
            key: 'action',
            header: 'Action',
            render: (e) => <Badge variant="info">{e.action}</Badge>,
          },
          {
            key: 'resource_type',
            header: 'Resource',
            render: (e) => `${e.resource_type} (${String(e.resource_id).slice(0, 8)})`,
          },
          {
            key: 'actor_email',
            header: 'Actor',
            render: (e) => e.actor_email || e.actor_id,
          },
          {
            key: 'created_at',
            header: 'Timestamp',
            render: (e) => (e.created_at ? formatDate(e.created_at, 'MMM d, yyyy HH:mm') : '—'),
          },
        ]}
      />
    </div>
  );
}
