import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import type { Task } from '@/types';

const sampleTasks: Task[] = [
  {
    id: 't-1',
    project_id: 'p-1',
    title: 'Design Auth API',
    description: null,
    status: 'todo',
    priority: 'high',
    version: 1,
  },
  {
    id: 't-2',
    project_id: 'p-1',
    title: 'Implement Optimistic Lock',
    description: null,
    status: 'in_progress',
    priority: 'critical',
    version: 3,
  },
  {
    id: 't-3',
    project_id: 'p-1',
    title: 'Verify CI Workflow',
    description: null,
    status: 'done',
    priority: 'medium',
    version: 2,
  },
];

describe('TaskBoard component', () => {
  it('renders columns and groups tasks into the correct status column', () => {
    const onSelect = jest.fn();
    const onAdd = jest.fn();
    render(<TaskBoard tasks={sampleTasks} onSelectTask={onSelect} onAddTask={onAdd} />);

    expect(screen.getByRole('region', { name: 'To Do column' })).toHaveTextContent('Design Auth API');
    expect(screen.getByRole('region', { name: 'In Progress column' })).toHaveTextContent(
      'Implement Optimistic Lock',
    );
    expect(screen.getByRole('region', { name: 'Done column' })).toHaveTextContent('Verify CI Workflow');

    fireEvent.click(screen.getByText('Implement Optimistic Lock'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 't-2', version: 3 }));

    fireEvent.click(screen.getByRole('button', { name: 'Add task to To Do' }));
    expect(onAdd).toHaveBeenCalledWith('todo');
  });
});
