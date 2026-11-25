'use client';

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { put } from '@/lib/api';
import type { RootState } from '@/store/store';

export default function SettingsPage() {
  const { user, currentOrg } = useSelector((s: RootState) => s.auth);
  const { addToast } = useToast();
  const [orgName, setOrgName] = useState(currentOrg?.name || '');

  const { mutateAsync: updateOrg, isPending } = useMutation({
    mutationFn: () => put(`/organizations/${currentOrg!.id}`, { name: orgName }),
    onSuccess: () => addToast('Organization settings saved', 'success'),
    onError: () => addToast('Only organization owners can update settings', 'error'),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="text-sm text-secondary-500">Manage your profile and workspace preferences.</p>
      </div>

      <Card title="Profile Information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-secondary-500">Full Name</p>
            <p className="font-medium text-secondary-900">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
          <div>
            <p className="text-secondary-500">Email</p>
            <p className="font-medium text-secondary-900">{user?.email}</p>
          </div>
        </div>
      </Card>

      {currentOrg && (
        <Card title="Organization Settings">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateOrg();
            }}
            className="space-y-4"
          >
            <Input label="Organization Name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <Button type="submit" loading={isPending}>
              Save Organization
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
