'use client';

import React, { useState } from 'react';
import { AxiosError } from 'axios';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useUpdateTask } from '@/hooks/useTasks';
import type { Task, TaskStatus } from '@/types';
import { CommentThread } from './CommentThread';

export function TaskDetail({ task, onClose }: { task: Task; onClose?: () => void }) {
  const { addToast } = useToast();
  const { mutateAsync: updateTask, isPending } = useUpdateTask();
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'details'>('comments');

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setConflictWarning(null);
    try {
      await updateTask({
        id: task.id,
        status: newStatus,
        version: task.version,
      });
      addToast('Task status updated', 'success');
      onClose?.();
    } catch (err) {
      const axiosErr = err as AxiosError<{ error?: { code?: string; message?: string } }>;
      if (axiosErr.response?.status === 409) {
        setConflictWarning(
          axiosErr.response.data?.error?.message ||
            'Another user modified this task simultaneously. Refreshing latest version.',
        );
      } else {
        addToast('Failed to update task', 'error');
      }
    }
  };

  return (
    <div className="space-y-5">
      {conflictWarning && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-warning-300 bg-warning-50 p-3 text-xs text-warning-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
          <span>{conflictWarning}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-secondary-400">Version {task.version}</span>
          <h3 className="text-lg font-bold text-secondary-900">{task.title}</h3>
        </div>
        <Badge variant="info">{task.priority}</Badge>
      </div>

      <p className="text-sm text-secondary-600">{task.description || 'No description provided.'}</p>

      <div className="max-w-xs">
        <Select
          label="Status"
          disabled={isPending}
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          options={[
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'in_review', label: 'In Review' },
            { value: 'done', label: 'Done' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
      </div>

      <div className="border-b border-secondary-200 flex gap-4 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('comments')}
          className={`pb-2 border-b-2 ${
            activeTab === 'comments' ? 'border-primary-600 text-primary-700' : 'border-transparent text-secondary-500'
          }`}
        >
          Comments
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`pb-2 border-b-2 ${
            activeTab === 'details' ? 'border-primary-600 text-primary-700' : 'border-transparent text-secondary-500'
          }`}
        >
          Estimates & Dates
        </button>
      </div>

      {activeTab === 'comments' ? (
        <CommentThread taskId={task.id} />
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-secondary-500">Due Date</dt>
            <dd className="font-medium text-secondary-900">{task.due_date || task.dueDate || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-secondary-500">Estimated Hours</dt>
            <dd className="font-medium text-secondary-900">{task.estimated_hours ?? task.estimatedHours ?? '—'}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
