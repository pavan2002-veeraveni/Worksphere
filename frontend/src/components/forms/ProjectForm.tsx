'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Project } from '@/types';

const projectSchema = z
  .object({
    name: z.string().trim().min(1, 'Project name is required').max(255),
    description: z.string().max(5000).optional(),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'archived']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export type ProjectFormValues = z.infer<typeof projectSchema>;

export interface ProjectFormProps {
  initialData?: Project;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
  onCancel?: () => void;
  loading?: boolean;
}

export function ProjectForm({ initialData, onSubmit, onCancel, loading }: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      status: initialData?.status || 'planning',
      priority: initialData?.priority || 'medium',
      startDate: (initialData?.start_date || initialData?.startDate || '')?.slice(0, 10),
      endDate: (initialData?.end_date || initialData?.endDate || '')?.slice(0, 10),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input label="Project Name" placeholder="e.g. Q3 Platform Launch" error={errors.name?.message} {...register('name')} />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-secondary-700">Description</label>
        <textarea
          rows={3}
          placeholder="Scope and objectives..."
          className="w-full rounded-lg border border-secondary-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          {...register('description')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Status"
          options={[
            { value: 'planning', label: 'Planning' },
            { value: 'active', label: 'Active' },
            { value: 'on_hold', label: 'On Hold' },
            { value: 'completed', label: 'Completed' },
            { value: 'archived', label: 'Archived' },
          ]}
          error={errors.status?.message}
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
          error={errors.priority?.message}
          {...register('priority')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input type="date" label="Start Date" error={errors.startDate?.message} {...register('startDate')} />
        <Input type="date" label="End Date" error={errors.endDate?.message} {...register('endDate')} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          {initialData ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}
