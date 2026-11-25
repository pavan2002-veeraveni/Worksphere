'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getEffectiveRole, ROLE_METADATA } from '@/lib/roles';
import type { RootState } from '@/store/store';
import type { LoginRole } from '@/types';

interface RoleGuardProps {
  allowedRoles: LoginRole[];
  resourceLabel: string;
  children: React.ReactNode;
}

export function RoleGuard({ allowedRoles, resourceLabel, children }: RoleGuardProps) {
  const { user, currentOrg, activeRole } = useSelector((s: RootState) => s.auth);
  const effectiveRole = getEffectiveRole(user, currentOrg, activeRole);

  const isAuthorized =
    Boolean(user) &&
    effectiveRole !== null &&
    (allowedRoles.includes(effectiveRole) ||
      (allowedRoles.includes('platform_admin') && Boolean(user?.isPlatformAdmin)));

  if (!isAuthorized) {
    const currentMeta = effectiveRole ? ROLE_METADATA[effectiveRole] : ROLE_METADATA.team_member;
    const allowedLabels = allowedRoles.map((r) => ROLE_METADATA[r].label).join(', ');

    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold text-secondary-900">
            Restricted Access: {resourceLabel}
          </h2>
          <p className="mt-1 max-w-md text-sm text-secondary-500">
            Your active session role is{' '}
            <Badge variant={currentMeta.badgeVariant}>{currentMeta.label}</Badge>. Access to{' '}
            {resourceLabel} requires one of: <span className="font-medium text-secondary-700">{allowedLabels}</span>.
          </p>
          <div className="mt-5">
            <Link href={currentMeta.defaultRoute}>
              <Button>Go to {currentMeta.shortLabel} Workspace</Button>
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return <>{children}</>;
}
