'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { put } from '@/lib/api';
import { getEffectiveRole, ROLE_METADATA } from '@/lib/roles';
import { setCurrentOrg } from '@/store/slices/authSlice';
import type { RootState } from '@/store/store';

export default function SettingsPage() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { user, currentOrg, activeRole } = useSelector((s: RootState) => s.auth);
  const { addToast } = useToast();
  const [orgName, setOrgName] = useState(currentOrg?.name || '');

  useEffect(() => {
    setOrgName(currentOrg?.name || '');
  }, [currentOrg?.id, currentOrg?.name]);

  const effectiveRole = getEffectiveRole(user, currentOrg, activeRole);
  const roleMeta = effectiveRole ? ROLE_METADATA[effectiveRole] : ROLE_METADATA.team_member;
  const canEditOrg = effectiveRole === 'owner' || effectiveRole === 'platform_admin';

  const { mutateAsync: updateOrg, isPending } = useMutation({
    mutationFn: () => put(`/organizations/${currentOrg!.id}`, { name: orgName.trim() }),
    onSuccess: () => {
      if (currentOrg) {
        dispatch(setCurrentOrg({ ...currentOrg, name: orgName.trim() }));
      }
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      addToast('Organization settings saved', 'success');
    },
    onError: (err) => addToast((err as Error).message || 'Only organization owners can update settings', 'error'),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="text-sm text-secondary-500">Manage your profile and workspace preferences.</p>
      </div>

      <Card title="Profile & Role Session">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
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
          <div>
            <p className="text-secondary-500">Active Role</p>
            <Badge variant={roleMeta.badgeVariant} className="mt-1">
              {roleMeta.label}
            </Badge>
          </div>
        </div>
      </Card>

      {currentOrg && (
        <Card title="Organization Settings">
          {canEditOrg ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!orgName.trim()) {
                  addToast('Organization name is required', 'error');
                  return;
                }
                updateOrg();
              }}
              className="space-y-4"
            >
              <Input
                label="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
              <Button type="submit" loading={isPending}>
                Save Organization
              </Button>
            </form>
          ) : (
            <p className="text-sm text-secondary-600">
              Workspace: <span className="font-semibold text-secondary-900">{currentOrg.name}</span> ({currentOrg.plan} plan). Organization modifications are restricted to Organization Owners.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
