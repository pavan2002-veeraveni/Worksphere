'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Task } from '@/types';

const taskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(500),
  description: z.string().max(10000).optional(),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().nonnegative('Must be non-negative').optional(),
});

export type TaskFormValues = z.infer<typeof taskSchema>;

export interface TaskFormProps {
  initialData?: Task;
  defaultStatus?: Task['status'];
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
}

export function TaskForm({ initialData, defaultStatus = 'todo', onSubmit, onCancel, loading }: TaskFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      status: initialData?.status || defaultStatus,
      priority: initialData?.priority || 'medium',
      dueDate: (initialData?.due_date || initialData?.dueDate || '')?.slice(0, 10),
      estimatedHours: initialData?.estimated_hours ?? initialData?.estimatedHours ?? undefined,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Task Title" placeholder="e.g. Implement optimistic locking" error={errors.title?.message} {...register('title')} />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-secondary-700">Description</label>
        <textarea
          rows={3}
          placeholder="Acceptance criteria and notes..."
          className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Status"
          options={[
            { value: 'todo', label: 'To Do' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'in_review', label: 'In Review' },
            { value: 'done', label: 'Done' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          {...register('status')}
        />
        <Select
          label="Priority"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ]}
          {...register('priority')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input type="date" label="Due Date" {...register('dueDate')} />
        <Input
          type="number"
          step="0.5"
          label="Estimated Hours"
          error={errors.estimatedHours?.message}
          {...register('estimatedHours')}
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {initialData ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  );
}
