import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '@/components/projects/ProjectCard';
import type { Project } from '@/types';

const sampleProject: Project = {
  id: 'proj-1',
  org_id: 'org-1',
  name: 'Platform Redesign',
  description: 'Modernize the multi-tenant workspace UI',
  status: 'active',
  priority: 'critical',
  end_date: '2026-12-31',
  settings: {},
  version: 1,
};

describe('ProjectCard component', () => {
  it('renders project name, status badge, priority badge, and link', () => {
    render(<ProjectCard project={sampleProject} />);
    expect(screen.getByText('Platform Redesign')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/projects/proj-1');
  });
});
