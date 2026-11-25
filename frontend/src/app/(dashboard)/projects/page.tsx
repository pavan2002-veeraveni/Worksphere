'use client';

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { ProjectForm, ProjectFormValues } from '@/components/forms/ProjectForm';
import { ProjectList } from '@/components/projects/ProjectList';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useCreateProject, useProjects } from '@/hooks/useProjects';
import { getEffectiveRole } from '@/lib/roles';
import type { RootState } from '@/store/store';

export default function ProjectsPage() {
  const { user, currentOrg, activeRole } = useSelector((s: RootState) => s.auth);
  const { data: res, isLoading } = useProjects(currentOrg?.id);
  const { mutateAsync: createProject, isPending } = useCreateProject();
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const effectiveRole = getEffectiveRole(user, currentOrg, activeRole);
  const canCreate =
    effectiveRole === 'platform_admin' ||
    effectiveRole === 'owner' ||
    effectiveRole === 'project_manager';

  const handleCreate = async (values: ProjectFormValues) => {
    try {
      await createProject({
        ...values,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      });
      addToast('Project created successfully', 'success');
      setModalOpen(false);
    } catch {
      addToast('Failed to create project', 'error');
    }
  };

  if (isLoading) return <LoadingSpinner label="Loading projects..." />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-secondary-900">Projects</h1>
        <p className="text-sm text-secondary-500">Manage tenant projects, milestones, and deliverables.</p>
      </div>

      <ProjectList
        projects={res?.data || []}
        canCreate={canCreate}
        onCreateClick={() => setModalOpen(true)}
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Project">
        <ProjectForm
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
          loading={isPending}
        />
      </Modal>
    </div>
  );
}
