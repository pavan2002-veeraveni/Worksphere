import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { TaskForm } from '@/components/forms/TaskForm';
import { TaskDetail } from '@/components/tasks/TaskDetail';
import { ToastProvider } from '@/components/ui/Toast';
import * as api from '@/lib/api';
import { store } from '@/store/store';
import type { Task } from '@/types';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    get: jest.fn(),
    put: jest.fn(),
  };
});

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedPut = api.put as jest.MockedFunction<typeof api.put>;

const SAMPLE_TASK: Task = {
  id: 'task-1',
  title: 'Concurrent Lock Check',
  description: 'Verify 409 warning surfaces to user',
  status: 'todo',
  priority: 'high',
  version: 2,
};

describe('TaskDetail & TaskForm regression checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ success: true, data: [] });
  });

  it('displays 409 optimistic lock conflict alert when API error includes status 409', async () => {
    const conflictErr: api.ApiClientError = new Error(
      'Concurrent modification detected on task: expected version 2, actual version 3',
    );
    conflictErr.status = 409;
    conflictErr.code = 'OPTIMISTIC_LOCK_CONFLICT';
    mockedPut.mockRejectedValueOnce(conflictErr);

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <Provider store={store}>
        <QueryClientProvider client={qc}>
          <ToastProvider>
            <TaskDetail task={SAMPLE_TASK} />
          </ToastProvider>
        </QueryClientProvider>
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_progress' } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Concurrent modification detected on task: expected version 2, actual version 3',
    );
  });

  it('keeps estimatedHours undefined when left blank instead of coercing to 0', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Task Title'), { target: { value: 'Empty hours check' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].estimatedHours).toBeUndefined();
  });
});
