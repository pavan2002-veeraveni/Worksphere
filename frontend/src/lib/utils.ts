import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Merge class names with Tailwind conflict resolution.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string or Date to a human-readable string.
 */
export function formatDate(
  date: string | Date,
  fmt: string = 'MMM d, yyyy',
): string {
  return format(new Date(date), fmt);
}

/**
 * Format a date as a relative string, e.g. "2 hours ago".
 */
export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/**
 * Truncate a string to the given length with an ellipsis.
 */
export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trimEnd() + '…';
}

/**
 * Get initials from first and last name.
 */
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Get a Tailwind color class for a given status.
 */
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    // Project statuses
    planning: 'bg-secondary-100 text-secondary-700',
    active: 'bg-primary-100 text-primary-700',
    on_hold: 'bg-warning-100 text-warning-700',
    completed: 'bg-success-100 text-success-700',
    cancelled: 'bg-danger-100 text-danger-700',
    // Task statuses
    todo: 'bg-secondary-100 text-secondary-700',
    in_progress: 'bg-primary-100 text-primary-700',
    in_review: 'bg-warning-100 text-warning-700',
    done: 'bg-success-100 text-success-700',
    // Milestone statuses
    pending: 'bg-secondary-100 text-secondary-700',
    overdue: 'bg-danger-100 text-danger-700',
  };
  return map[status] || 'bg-secondary-100 text-secondary-700';
}

/**
 * Get a Tailwind color class for a given priority.
 */
export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    low: 'bg-secondary-100 text-secondary-700',
    medium: 'bg-primary-100 text-primary-700',
    high: 'bg-warning-100 text-warning-700',
    critical: 'bg-danger-100 text-danger-700',
  };
  return map[priority] || 'bg-secondary-100 text-secondary-700';
}

/**
 * Get a human-readable label for a status code.
 */
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
    cancelled: 'Cancelled',
    todo: 'To Do',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done',
    pending: 'Pending',
    overdue: 'Overdue',
  };
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
