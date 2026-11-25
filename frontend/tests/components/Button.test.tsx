import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button component', () => {
  it('renders label and triggers onClick', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Save Task</Button>);
    const btn = screen.getByRole('button', { name: 'Save Task' });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button and shows aria-busy when loading', () => {
    const handleClick = jest.fn();
    render(
      <Button loading onClick={handleClick}>
        Submitting
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Submitting' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(btn);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-danger-600');
  });
});
