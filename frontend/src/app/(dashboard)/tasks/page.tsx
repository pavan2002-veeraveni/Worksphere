'use client';

import React, { useState } from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { useSelector } from 'react-redux';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useTasks } from '@/hooks/useTasks';
import { getStatusLabel } from '@/lib/utils';
import type { RootState } from '@/store/store';
import type { Task } from '@/types';

export default function MyTasksPage() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [view, setView] = useState<'board' | 'list'>('board');
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: res, isLoading } = useTasks(
    onlyMine && user ? { assigneeId: user.id, limit: 100 } : { limit: 100 },
  );

  if (isLoading) return <LoadingSpinner label="Loading tasks..." />;
  const tasks = res?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Tasks</h1>
          <p className="text-sm text-secondary-500">Track task status and collaborate across teams.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={onlyMine ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setOnlyMine((p) => !p)}
          >
            {onlyMine ? 'Showing My Tasks' : 'Filter: Assigned to Me'}
          </Button>
          <Button
            variant={view === 'board' ? 'primary' : 'outline'}
            size="sm"
            leftIcon={<LayoutGrid className="h-4 w-4" />}
            onClick={() => setView('board')}
          >
            Board
          </Button>
          <Button
            variant={view === 'list' ? 'primary' : 'outline'}
            size="sm"
            leftIcon={<List className="h-4 w-4" />}
            onClick={() => setView('list')}
          >
            List
          </Button>
        </div>
      </div>

      {view === 'board' ? (
        <TaskBoard tasks={tasks} onSelectTask={(t) => setSelectedTask(t)} />
      ) : (
        <DataTable
          data={tasks}
          columns={[
            {
              key: 'title',
              header: 'Title',
              render: (t) => (
                <button
                  type="button"
                  onClick={() => setSelectedTask(t)}
                  className="font-medium text-primary-700 hover:underline"
                >
                  {t.title}
                </button>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (t) => <Badge variant="info">{getStatusLabel(t.status)}</Badge>,
            },
            { key: 'priority', header: 'Priority' },
            { key: 'version', header: 'Version', render: (t) => `v${t.version}` },
          ]}
        />
      )}

      <Modal
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        title="Task Detail"
        size="lg"
      >
        {selectedTask && <TaskDetail task={selectedTask} onClose={() => setSelectedTask(null)} />}
      </Modal>
    </div>
  );
}
