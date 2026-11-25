import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectForm } from '@/components/forms/ProjectForm';

describe('ProjectForm component', () => {
  it('validates required name and submits valid data', async () => {
    const onSubmit = jest.fn();
    render(<ProjectForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText('Project name is required')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'New SaaS Rollout' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'New SaaS Rollout', status: 'planning', priority: 'medium' }),
    );
  });
});
