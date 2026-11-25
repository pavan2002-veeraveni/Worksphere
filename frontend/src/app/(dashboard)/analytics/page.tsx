'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { get } from '@/lib/api';
import type { RootState } from '@/store/store';

interface SummaryData {
  total_projects: number;
  active_projects: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  avg_completion_rate: number;
  top_projects: Array<{ project_id: string; name: string; total_tasks: number; completed_tasks: number; completion_rate: number }>;
}

interface WorkloadData {
  members: Array<{ user_id: string; name: string; assigned_tasks: number; completed_tasks: number; utilization_rate: number }>;
}

export default function AnalyticsPage() {
  const { currentOrg } = useSelector((s: RootState) => s.auth);

  const { data: summary, isLoading: loadingSum } = useQuery({
    queryKey: ['analyticsSummary', currentOrg?.id],
    queryFn: async () => (await get<SummaryData>('/integrations/analytics/summary')).data,
    enabled: Boolean(currentOrg?.id),
    retry: false,
  });

  const { data: workload } = useQuery({
    queryKey: ['analyticsWorkload', currentOrg?.id],
    queryFn: async () => (await get<WorkloadData>('/integrations/analytics/workload')).data,
    enabled: Boolean(currentOrg?.id),
    retry: false,
  });

  if (loadingSum) return <LoadingSpinner label="Fetching analytics from FastAPI service..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Delivery & Health Analytics</h1>
        <p className="text-sm text-secondary-500">Powered by the WorkSphere FastAPI Analytics microservice.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card title="Completion Rate">
          <p className="text-3xl font-bold text-primary-700">
            {summary ? `${Math.round(summary.avg_completion_rate * 100)}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-secondary-500">
            {summary ? `${summary.completed_tasks} of ${summary.total_tasks} tasks completed` : 'Analytics service offline'}
          </p>
        </Card>
        <Card title="Active Projects">
          <p className="text-3xl font-bold text-secondary-900">{summary?.active_projects ?? '—'}</p>
          <p className="mt-1 text-xs text-secondary-500">Out of {summary?.total_projects ?? 0} total</p>
        </Card>
        <Card title="Overdue Work">
          <p className="text-3xl font-bold text-danger-600">{summary?.overdue_tasks ?? '—'}</p>
          <p className="mt-1 text-xs text-secondary-500">Tasks past due date</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Team Workload Distribution">
          {!workload?.members?.length ? (
            <p className="text-sm text-secondary-500">No workload metrics available yet.</p>
          ) : (
            <div className="space-y-3">
              {workload.members.map((m) => (
                <div key={m.user_id} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{m.name}</span>
                    <span>
                      {m.completed_tasks}/{m.assigned_tasks} ({Math.round(m.utilization_rate * 100)}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary-100">
                    <div
                      className="h-2.5 rounded-full bg-primary-600"
                      style={{ width: `${Math.min(100, Math.round(m.utilization_rate * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top Performing Projects">
          {!summary?.top_projects?.length ? (
            <p className="text-sm text-secondary-500">No project breakdown available.</p>
          ) : (
            <div className="space-y-3">
              {summary.top_projects.map((p) => (
                <div key={p.project_id} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span>{p.name}</span>
                    <span>{Math.round(p.completion_rate * 100)}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-secondary-100">
                    <div
                      className="h-2.5 rounded-full bg-success-500"
                      style={{ width: `${Math.min(100, Math.round(p.completion_rate * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
