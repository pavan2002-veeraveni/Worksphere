'use client';

import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

const inviteSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum(['project_manager', 'team_member', 'auditor']),
});

export type InviteMemberValues = z.infer<typeof inviteSchema>;

export function InviteMemberForm({
  onSubmit,
  loading,
}: {
  onSubmit: (values: InviteMemberValues) => Promise<void> | void;
  loading?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'team_member' },
  });

  const submitHandler = async (values: InviteMemberValues) => {
    await onSubmit(values);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Input label="Colleague Email" placeholder="colleague@company.com" error={errors.email?.message} {...register('email')} />
      <Select
        label="Role"
        options={[
          { value: 'project_manager', label: 'Project Manager' },
          { value: 'team_member', label: 'Team Member' },
          { value: 'auditor', label: 'Auditor (Read-Only)' },
        ]}
        {...register('role')}
      />
      <Button type="submit" loading={loading} className="shrink-0">
        Send Invite
      </Button>
    </form>
  );
}
