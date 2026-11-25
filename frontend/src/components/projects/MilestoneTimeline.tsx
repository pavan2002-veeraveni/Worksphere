'use client';

import React from 'react';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDate, getStatusLabel } from '@/lib/utils';
import type { Milestone } from '@/types';

export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  if (milestones.length === 0) {
    return <p className="text-sm text-secondary-500">No milestones scheduled yet.</p>;
  }

  return (
    <ol className="relative border-l border-secondary-200 ml-3 space-y-6">
      {milestones.map((m) => {
        const dueDate = m.due_date || m.dueDate;
        return (
          <li key={m.id} className="ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-4 ring-white">
              {m.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-success-600" />
              ) : m.status === 'in_progress' ? (
                <Clock className="h-5 w-5 text-warning-600" />
              ) : (
                <Circle className="h-5 w-5 text-secondary-400" />
              )}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-secondary-200 bg-white p-3">
              <div>
                <p className="text-sm font-semibold text-secondary-900">{m.name}</p>
                {m.description && <p className="text-xs text-secondary-500">{m.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    m.status === 'completed'
                      ? 'success'
                      : m.status === 'overdue'
                        ? 'danger'
                        : m.status === 'in_progress'
                          ? 'warning'
                          : 'default'
                  }
                >
                  {getStatusLabel(m.status)}
                </Badge>
                {dueDate && <span className="text-xs text-secondary-500">{formatDate(dueDate)}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
