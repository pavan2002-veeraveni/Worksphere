'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, LogOut, Menu, Search, Settings, ShieldAlert, User as UserIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { useLogout } from '@/hooks/useAuth';
import { useMarkAsRead, useNotifications, useRealTimeNotifications, useUnreadCount } from '@/hooks/useNotifications';
import { canAccessRoute, getEffectiveRole, ROLE_METADATA } from '@/lib/roles';
import { setActiveRole, setCurrentOrg } from '@/store/slices/authSlice';
import { toggleSidebar } from '@/store/slices/uiSlice';
import type { RootState } from '@/store/store';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { user, currentOrg, activeRole } = useSelector((s: RootState) => s.auth);
  const { mutate: logout } = useLogout();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const effectiveRole = getEffectiveRole(user, currentOrg, activeRole);
  const roleMeta = effectiveRole ? ROLE_METADATA[effectiveRole] : null;

  useRealTimeNotifications(currentOrg?.id);
  const { data: unreadCount = 0 } = useUnreadCount(currentOrg?.id);
  const { data: notifications = [] } = useNotifications(currentOrg?.id);
  const { mutate: markAsRead } = useMarkAsRead();

  const handleOrgChange = (orgId: string) => {
    const selected = user?.organizations?.find((o) => o.id === orgId) || null;
    dispatch(setCurrentOrg(selected));
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'currentUser',
    });
    if (selected && user && !canAccessRoute(pathname, selected.role, user)) {
      router.push(ROLE_METADATA[selected.role].defaultRoute);
      return;
    }
    router.refresh();
  };

  const handleSwitchPlatformMode = () => {
    if (!user?.isPlatformAdmin) return;
    if (effectiveRole === 'platform_admin' && currentOrg) {
      dispatch(setActiveRole(currentOrg.role));
      router.push(ROLE_METADATA[currentOrg.role].defaultRoute);
    } else {
      dispatch(setActiveRole('platform_admin'));
      router.push('/admin');
    }
  };

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => router.push('/login'),
    });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-secondary-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 text-secondary-500 hover:bg-secondary-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {user?.organizations && user.organizations.length > 0 && (
          <select
            aria-label="Select active organization"
            value={currentOrg?.id || ''}
            onChange={(e) => handleOrgChange(e.target.value)}
            className="rounded-lg border border-secondary-300 bg-secondary-50 px-3 py-1.5 text-sm font-medium text-secondary-800 focus:border-primary-500 focus:outline-none"
          >
            {user.organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({ROLE_METADATA[org.role]?.label || org.role})
              </option>
            ))}
          </select>
        )}

        {user?.isPlatformAdmin && (
          <button
            type="button"
            onClick={handleSwitchPlatformMode}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-secondary-300 bg-white px-2.5 py-1.5 text-xs font-medium text-secondary-700 hover:bg-secondary-50"
          >
            <ShieldAlert className="h-3.5 w-3.5 text-danger-600" />
            {effectiveRole === 'platform_admin' && currentOrg
              ? `Switch to ${ROLE_METADATA[currentOrg.role].shortLabel}`
              : 'Platform Admin Console'}
          </button>
        )}

        <div className="hidden md:flex items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-1.5 text-sm text-secondary-500 w-64">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search workspace"
            placeholder="Search projects & tasks..."
            className="w-full bg-transparent text-secondary-800 placeholder:text-secondary-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {roleMeta && (
          <Badge variant={roleMeta.badgeVariant} className="hidden sm:inline-flex">
            {roleMeta.label}
          </Badge>
        )}

        {/* Notifications dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            aria-label="Open notifications"
            className="relative rounded-lg p-2 text-secondary-600 hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-secondary-200 bg-white p-3 shadow-lg z-40">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-secondary-900">Notifications</h4>
                <span className="text-xs text-secondary-500">{unreadCount} unread</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="py-4 text-center text-xs text-secondary-500">All caught up!</p>
                ) : (
                  notifications.slice(0, 8).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => markAsRead(n.id)}
                      className={`w-full rounded-lg p-2 text-left text-xs transition ${
                        n.is_read || n.isRead ? 'bg-white text-secondary-500' : 'bg-primary-50 text-secondary-900'
                      } hover:bg-secondary-50`}
                    >
                      <p className="font-semibold">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2">{n.message}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            aria-label="User menu"
            className="flex items-center gap-2 rounded-lg p-1 hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Avatar
              src={user?.avatarUrl}
              name={user ? `${user.firstName} ${user.lastName}` : 'User'}
              size="sm"
            />
            <span className="hidden sm:inline text-sm font-medium text-secondary-800">
              {user ? `${user.firstName} ${user.lastName}` : 'Account'}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-secondary-200 bg-white py-1 shadow-lg z-40">
              {user && (
                <div className="border-b border-secondary-100 px-4 py-2">
                  <p className="truncate text-xs font-medium text-secondary-900">{user.email}</p>
                  {roleMeta && (
                    <Badge variant={roleMeta.badgeVariant} className="mt-1">
                      {roleMeta.label}
                    </Badge>
                  )}
                </div>
              )}
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
              >
                <UserIcon className="h-4 w-4" /> Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-secondary-700 hover:bg-secondary-50"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-danger-600 hover:bg-danger-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
