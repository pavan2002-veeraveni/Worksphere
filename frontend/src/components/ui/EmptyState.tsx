import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-secondary-300 bg-white px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-secondary-100 p-3 text-secondary-500">{icon}</div>
      <h3 className="text-base font-semibold text-secondary-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-secondary-500">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
