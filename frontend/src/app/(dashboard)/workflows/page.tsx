'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Workflow } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { get, post } from '@/lib/api';
import type { RootState } from '@/store/store';
import type { WorkflowRule } from '@/types';

export default function WorkflowsPage() {
  const { currentOrg } = useSelector((s: RootState) => s.auth);
  const { addToast } = useToast();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('task.created');

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['workflowRules', currentOrg?.id],
    queryFn: async () => (await get<WorkflowRule[]>('/workflow-rules')).data || [],
    enabled: Boolean(currentOrg?.id),
  });

  const { mutateAsync: createRule, isPending } = useMutation({
    mutationFn: () =>
      post('/workflow-rules', {
        name,
        triggerEvent,
        conditions: [{ field: 'priority', operator: 'equals', value: 'critical' }],
        actions: [{ type: 'send_notification', params: { title: 'Critical Task Escalation' } }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflowRules'] });
      setName('');
      setModalOpen(false);
      addToast('Workflow rule created', 'success');
    },
  });

  if (isLoading) return <LoadingSpinner label="Loading automation rules..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Workflow Automation</h1>
          <p className="text-sm text-secondary-500">Automate task assignments, subtasks, and notifications.</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<Workflow className="h-6 w-6" />}
          title="No automation rules yet"
          description="Create event-driven rules to automate notifications and subtasks."
          actionLabel="Create Rule"
          onAction={() => setModalOpen(true)}
        />
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-secondary-900">{r.name}</h3>
                  <p className="text-xs text-secondary-500">Trigger: {r.trigger_event || r.triggerEvent}</p>
                </div>
                <Badge variant={r.is_active || r.isActive ? 'success' : 'default'}>
                  {r.is_active || r.isActive ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Create Workflow Rule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createRule();
          }}
          className="space-y-4"
        >
          <Input label="Rule Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Trigger Event"
            value={triggerEvent}
            onChange={(e) => setTriggerEvent(e.target.value)}
            options={[
              { value: 'task.created', label: 'Task Created' },
              { value: 'task.status_changed', label: 'Task Status Changed' },
              { value: 'task.assigned', label: 'Task Assigned' },
              { value: 'comment.created', label: 'Comment Created' },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Create Rule
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
