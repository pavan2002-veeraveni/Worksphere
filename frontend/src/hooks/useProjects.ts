import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, post, put } from '@/lib/api';
import type { Milestone, Project } from '@/types';

export function useProjects(
  orgId?: string,
  filters?: { status?: string; priority?: string; search?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['projects', orgId, filters],
    queryFn: async () => {
      const res = await get<Project[]>('/projects', filters as Record<string, unknown>);
      return res;
    },
    enabled: Boolean(orgId),
  });
}

export function useProject(projectId?: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const res = await get<Project>(`/projects/${projectId}`);
      return res.data!;
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await post<Project>('/projects', payload);
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; version: number } & Record<string, unknown>) => {
      const res = await put<Project>(`/projects/${id}`, payload);
      return res.data!;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', updated.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await del(`/projects/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useMilestones(projectId?: string) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      const res = await get<Milestone[]>(`/projects/${projectId}/milestones`);
      return res.data || [];
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await post<Milestone>(`/projects/${projectId}/milestones`, payload);
      return res.data!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', projectId] });
    },
  });
}
