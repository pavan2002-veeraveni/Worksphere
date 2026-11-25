import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, actions, children, className }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-secondary-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-secondary-100 px-5 py-4">
          {title && <h3 className="text-base font-semibold text-secondary-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
