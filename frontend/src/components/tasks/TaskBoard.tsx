'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { getStatusLabel } from '@/lib/utils';
import type { Task, TaskStatus } from '@/types';
import { TaskCard } from './TaskCard';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];

export interface TaskBoardProps {
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
  onAddTask?: (status: TaskStatus) => void;
}

export function TaskBoard({ tasks, onSelectTask, onAddTask }: TaskBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={`${getStatusLabel(status)} column`}
            className="flex flex-col rounded-xl border border-secondary-200 bg-secondary-50 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-secondary-800">{getStatusLabel(status)}</h3>
                <span className="rounded-full bg-secondary-200 px-2 py-0.5 text-xs font-medium text-secondary-700">
                  {columnTasks.length}
                </span>
              </div>
              {onAddTask && (
                <button
                  type="button"
                  onClick={() => onAddTask(status)}
                  aria-label={`Add task to ${getStatusLabel(status)}`}
                  className="rounded-md p-1 text-secondary-500 hover:bg-secondary-200 hover:text-secondary-800"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {columnTasks.length === 0 ? (
                <p className="py-6 text-center text-xs text-secondary-400">No tasks</p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={onSelectTask} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
