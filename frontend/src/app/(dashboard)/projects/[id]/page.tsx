'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FolderKanban } from 'lucide-react';
import { useSelector } from 'react-redux';
import { MilestoneTimeline } from '@/components/projects/MilestoneTimeline';
import { TaskForm, TaskFormValues } from '@/components/forms/TaskForm';
import { ProjectForm, ProjectFormValues } from '@/components/forms/ProjectForm';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useMilestones, useProject, useUpdateProject } from '@/hooks/useProjects';
import { useCreateTask, useTasks } from '@/hooks/useTasks';
import { getEffectiveRole } from '@/lib/roles';
import { getStatusLabel } from '@/lib/utils';
import type { RootState } from '@/store/store';
import type { Task, TaskStatus } from '@/types';

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const { user, currentOrg, activeRole } = useSelector((s: RootState) => s.auth);
  const effectiveRole = getEffectiveRole(user, currentOrg, activeRole);
  const canCreateTasks =
    effectiveRole === 'platform_admin' ||
    effectiveRole === 'owner' ||
    effectiveRole === 'project_manager' ||
    effectiveRole === 'team_member';
  const canEditProject =
    effectiveRole === 'platform_admin' ||
    effectiveRole === 'owner' ||
    effectiveRole === 'project_manager';
  const { addToast } = useToast();

  const { data: project, isLoading, isError } = useProject(projectId);
  const { data: tasksRes } = useTasks({ projectId, limit: 100 });
  const { data: milestones = [] } = useMilestones(projectId);
  const { mutateAsync: createTask, isPending: creatingTask } = useCreateTask();
  const { mutateAsync: updateProject, isPending: updatingProj } = useUpdateProject();

  const [tab, setTab] = useState<'overview' | 'tasks' | 'milestones' | 'settings'>('tasks');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus | null>(null);

  if (isLoading) return <LoadingSpinner label="Loading project..." />;
  if (isError || !project) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-6 w-6" />}
        title="Project Not Found"
        description="This project may not exist in your active organization workspace."
        actionLabel="Back to Projects"
        onAction={() => router.push('/projects')}
      />
    );
  }

  const tasks = tasksRes?.data || [];

  const handleCreateTask = async (values: TaskFormValues) => {
    try {
      await createTask({
        ...values,
        projectId,
        dueDate: values.dueDate || null,
      });
      addToast('Task created', 'success');
      setCreateStatus(null);
    } catch (err) {
      addToast((err as Error).message || 'Failed to create task', 'error');
    }
  };

  const handleUpdateProject = async (values: ProjectFormValues) => {
    try {
      await updateProject({
        id: project.id,
        version: project.version,
        ...values,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      });
      addToast('Project settings updated', 'success');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        addToast('Project was updated by another user. Refreshing latest version.', 'error');
      } else {
        addToast((err as Error).message || 'Failed to update project settings', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-secondary-900">{project.name}</h1>
            <Badge variant="info">{getStatusLabel(project.status)}</Badge>
            <Badge variant="default">v{project.version}</Badge>
          </div>
          <p className="mt-1 text-sm text-secondary-500">{project.description || 'No description'}</p>
        </div>
      </div>

      <div className="flex gap-6 border-b border-secondary-200 text-sm font-medium">
        {(['overview', 'tasks', 'milestones', ...(canEditProject ? (['settings'] as const) : [])] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-3 capitalize border-b-2 ${
              tab === t ? 'border-primary-600 text-primary-700' : 'border-transparent text-secondary-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Project Progress">
            <p className="text-sm text-secondary-600">
              Completed {tasks.filter((t) => t.status === 'done').length} of {tasks.length} tasks.
            </p>
          </Card>
          <Card title="Milestones">
            <MilestoneTimeline milestones={milestones} />
          </Card>
        </div>
      )}

      {tab === 'tasks' && (
        <TaskBoard
          tasks={tasks}
          onSelectTask={(t) => setSelectedTask(t)}
          onAddTask={canCreateTasks ? (status) => setCreateStatus(status) : undefined}
        />
      )}

      {tab === 'milestones' && (
        <Card title="Project Milestones">
          <MilestoneTimeline milestones={milestones} />
        </Card>
      )}

      {tab === 'settings' && canEditProject && (
        <Card title="Project Settings">
          <ProjectForm initialData={project} onSubmit={handleUpdateProject} loading={updatingProj} />
        </Card>
      )}

      <Modal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title="Task Details"
        size="lg"
      >
        {selectedTask && (
          <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(createStatus)}
        onClose={() => setCreateStatus(null)}
        title="New Task"
      >
        {createStatus && (
          <TaskForm
            defaultStatus={createStatus}
            onSubmit={handleCreateTask}
            onCancel={() => setCreateStatus(null)}
            loading={creatingTask}
          />
        )}
      </Modal>
    </div>
  );
}
