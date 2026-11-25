'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/lib/utils';
import type { Task } from '@/types';

const priorityColors: Record<string, 'default' | 'info' | 'warning' | 'danger'> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

export function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick?: (task: Task) => void;
}) {
  const dueDate = task.due_date || task.dueDate;

  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className="w-full rounded-lg border border-secondary-200 bg-white p-3 text-left shadow-xs transition hover:border-primary-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-secondary-900">{task.title}</span>
        <Badge variant={priorityColors[task.priority] || 'default'}>{task.priority}</Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-secondary-500">
        <span>v{task.version}</span>
        {dueDate && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            {formatDate(dueDate)}
          </span>
        )}
      </div>
    </button>
  );
}
