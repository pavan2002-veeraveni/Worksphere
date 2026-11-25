'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, getStatusLabel, truncate } from '@/lib/utils';
import type { Project } from '@/types';

const statusBadgeVariant: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  planning: 'default',
  active: 'info',
  on_hold: 'warning',
  completed: 'success',
  archived: 'default',
};

const priorityBadgeVariant: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

export function ProjectCard({ project }: { project: Project }) {
  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl border border-secondary-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-secondary-900 group-hover:text-primary-700">
          {project.name}
        </h3>
        <Badge variant={priorityBadgeVariant[project.priority] || 'default'}>
          {project.priority}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-secondary-600 line-clamp-2">
        {project.description ? truncate(project.description, 120) : 'No description provided.'}
      </p>

      <div className="mt-4 flex items-center justify-between pt-3 border-t border-secondary-100">
        <Badge variant={statusBadgeVariant[project.status] || 'default'}>
          {getStatusLabel(project.status)}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-secondary-500">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{endDate ? formatDate(endDate) : startDate ? formatDate(startDate) : 'No dates'}</span>
        </div>
      </div>
    </Link>
  );
}
