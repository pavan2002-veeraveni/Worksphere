import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { get, put } from '@/lib/api';
import { getStoredTokens } from '@/lib/auth';
import type { Notification } from '@/types';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

function resolveSocketTarget(rawUrl: string): { url?: string; usePolling: boolean } {
  if (rawUrl === '/' || rawUrl === 'same-origin') {
    return { url: undefined, usePolling: false };
  }
  const isLocalHttp = rawUrl.startsWith('http://localhost') || rawUrl.startsWith('http://127.0.0.1');
  return { url: rawUrl, usePolling: isLocalHttp };
}

export function useNotifications(orgId?: string) {
  return useQuery({
    queryKey: ['notifications', orgId],
    queryFn: async () => {
      const res = await get<Notification[]>('/notifications');
      return res.data || [];
    },
    enabled: Boolean(orgId),
  });
}

export function useUnreadCount(orgId?: string) {
  return useQuery({
    queryKey: ['unreadCount', orgId],
    queryFn: async () => {
      const res = await get<{ unreadCount: number }>('/notifications/unread-count');
      return res.data?.unreadCount ?? 0;
    },
    enabled: Boolean(orgId),
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await put<Notification>(`/notifications/${id}/read`);
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    },
  });
}

export function useRealTimeNotifications(orgId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const tokens = getStoredTokens();
    if (!tokens || !orgId) return;

    const { url, usePolling } = resolveSocketTarget(WS_URL);
    const socketOptions = {
      auth: { token: tokens.accessToken, orgId },
      transports: usePolling ? ['websocket', 'polling'] : ['websocket'],
    };

    const socket = url ? io(url, socketOptions) : io(socketOptions);

    socket.on('notification:new', () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unreadCount'] });
    });

    socket.on('task:updated', () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    });

    socket.on('task:created', () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    });

    socket.on('project:updated', () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [orgId, qc]);
}
