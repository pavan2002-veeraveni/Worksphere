'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Shield,
  ShieldAlert,
  Users,
  Workflow,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { cn } from '@/lib/utils';
import { toggleSidebar } from '@/store/slices/uiSlice';
import type { RootState } from '@/store/store';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  platformAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'My Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Teams', href: '/teams', icon: Users },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  {
    label: 'Workflow Rules',
    href: '/workflows',
    icon: Workflow,
    roles: ['owner', 'project_manager'],
  },
  {
    label: 'Audit Log',
    href: '/audit-logs',
    icon: Shield,
    roles: ['owner', 'auditor'],
  },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Platform Admin', href: '/admin', icon: ShieldAlert, platformAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useDispatch();
  const sidebarOpen = useSelector((s: RootState) => s.ui.sidebarOpen);
  const { user, currentOrg } = useSelector((s: RootState) => s.auth);

  const visibleItems = navItems.filter((item) => {
    if (item.platformAdminOnly) return Boolean(user?.isPlatformAdmin);
    if (user?.isPlatformAdmin) return true;
    if (!item.roles) return true;
    return currentOrg ? item.roles.includes(currentOrg.role) : false;
  });

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'flex flex-col border-r border-secondary-200 bg-white transition-all duration-200',
        sidebarOpen ? 'w-64' : 'w-16',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-secondary-200 px-4">
        {sidebarOpen && (
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-primary-700 text-lg">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white text-sm">
              W
            </span>
            <span>WorkSphere</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="rounded-lg p-1.5 text-secondary-500 hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-100 hover:text-secondary-900',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {sidebarOpen && currentOrg && (
        <div className="border-t border-secondary-200 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-secondary-400">Workspace</p>
          <p className="mt-1 truncate text-sm font-semibold text-secondary-800">{currentOrg.name}</p>
          <p className="text-xs capitalize text-secondary-500">
            Role: {currentOrg.role.replace('_', ' ')} • {currentOrg.plan}
          </p>
        </div>
      )}
    </aside>
  );
}
