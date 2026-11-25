import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, post, put } from '@/lib/api';
import type { Comment, Task } from '@/types';

export function useTasks(filters?: {
  projectId?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const res = await get<Task[]>('/tasks', filters as Record<string, unknown>);
      return res;
    },
  });
}

export function useTask(taskId?: string) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      const res = await get<Task>(`/tasks/${taskId}`);
      return res.data!;
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await post<Task>('/tasks', payload);
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; version: number } & Record<string, unknown>) => {
      const res = await put<Task>(`/tasks/${id}`, payload);
      return res.data!;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', updated.id] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await del(`/tasks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useTaskComments(taskId?: string) {
  return useQuery({
    queryKey: ['taskComments', taskId],
    queryFn: async () => {
      const res = await get<Comment[]>(`/tasks/${taskId}/comments`);
      return res.data || [];
    },
    enabled: Boolean(taskId),
  });
}

export function useCreateComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { content: string; parentCommentId?: string | null }) => {
      const res = await post<Comment>(`/tasks/${taskId}/comments`, payload);
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taskComments', taskId] });
    },
  });
}
