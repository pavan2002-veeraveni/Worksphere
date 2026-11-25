'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FolderKanban, Plus, Users } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { get } from '@/lib/api';
import { formatDate, formatRelative, getStatusLabel } from '@/lib/utils';
import type { RootState } from '@/store/store';
import type { ActivityEntry } from '@/types';

export default function DashboardPage() {
  const { user, currentOrg } = useSelector((s: RootState) => s.auth);
  const { data: projectsRes, isLoading: projLoading } = useProjects(currentOrg?.id);
  const { data: tasksRes, isLoading: taskLoading } = useTasks({ limit: 50 });

  const { data: activity = [] } = useQuery({
    queryKey: ['recentActivity', currentOrg?.id],
    queryFn: async () => {
      const res = await get<ActivityEntry[]>('/activity', { limit: 10 });
      return res.data || [];
    },
    enabled: Boolean(currentOrg?.id),
  });

  if (projLoading || taskLoading) {
    return <LoadingSpinner label="Loading dashboard metrics..." />;
  }

  const projects = projectsRes?.data || [];
  const tasks = tasksRes?.data || [];
  const activeTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress' || t.status === 'in_review');
  const overdueTasks = tasks.filter((t) => {
    const due = t.due_date || t.dueDate;
    return due && t.status !== 'done' && t.status !== 'cancelled' && new Date(due) < new Date();
  });

  const canManageProjects =
    user?.isPlatformAdmin || currentOrg?.role === 'owner' || currentOrg?.role === 'project_manager';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Welcome back, {user?.firstName || 'User'}
          </h1>
          <p className="text-sm text-secondary-500">
            {currentOrg ? `${currentOrg.name} workspace overview` : 'Select or create an organization'}
          </p>
        </div>
        {canManageProjects && (
          <div className="flex gap-2">
            <Link href="/projects">
              <Button leftIcon={<Plus className="h-4 w-4" />}>New Project</Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline">View Tasks</Button>
            </Link>
          </div>
        )}
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-500">Total Projects</p>
              <p className="mt-1 text-2xl font-bold text-secondary-900">{projects.length}</p>
            </div>
            <FolderKanban className="h-8 w-8 text-primary-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-500">Active Tasks</p>
              <p className="mt-1 text-2xl font-bold text-secondary-900">{activeTasks.length}</p>
            </div>
            <CheckCircle2 className="h-8 w-8 text-success-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-500">Overdue Tasks</p>
              <p className="mt-1 text-2xl font-bold text-danger-600">{overdueTasks.length}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-danger-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-secondary-500">Active Role</p>
              <p className="mt-1 text-lg font-bold capitalize text-secondary-900">
                {currentOrg?.role.replace('_', ' ') || 'Member'}
              </p>
            </div>
            <Users className="h-8 w-8 text-warning-500" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Recent Activity">
          {activity.length === 0 ? (
            <p className="text-sm text-secondary-500">No recent activity logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((entry) => {
                const actor = entry.actor_first_name
                  ? `${entry.actor_first_name} ${entry.actor_last_name}`
                  : 'Team Member';
                const ts = entry.created_at || entry.createdAt;
                return (
                  <li key={entry.id} className="flex items-center justify-between border-b border-secondary-100 pb-2 text-sm last:border-0">
                    <div>
                      <span className="font-medium text-secondary-900">{actor}</span>{' '}
                      <span className="text-secondary-600">{entry.action.replace('.', ' ')}</span>
                    </div>
                    {ts && <span className="text-xs text-secondary-400">{formatRelative(ts)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Upcoming Deadlines">
          {activeTasks.length === 0 ? (
            <p className="text-sm text-secondary-500">No upcoming tasks due.</p>
          ) : (
            <ul className="space-y-3">
              {activeTasks.slice(0, 6).map((task) => {
                const due = task.due_date || task.dueDate;
                return (
                  <li key={task.id} className="flex items-center justify-between border-b border-secondary-100 pb-2 text-sm last:border-0">
                    <div>
                      <p className="font-medium text-secondary-900">{task.title}</p>
                      <p className="text-xs text-secondary-500">{getStatusLabel(task.status)}</p>
                    </div>
                    <Badge variant={task.priority === 'critical' ? 'danger' : 'default'}>
                      {due ? formatDate(due) : 'No due date'}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
