export interface CalendarTaskEvent {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  status: string;
  priority: string;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsDate(dateInput: string): string {
  return dateInput.slice(0, 10).replace(/-/g, '');
}

/**
 * Generates an RFC 5545 iCalendar (.ics) feed for project task due dates and milestones.
 */
export const calendarService = {
  generateProjectIcs(projectName: string, tasks: CalendarTaskEvent[]): string {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WorkSphere//Project Calendar//EN',
      `X-WR-CALNAME:${escapeIcs(projectName)}`,
    ];

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const dateStr = formatIcsDate(task.dueDate);
      lines.push(
        'BEGIN:VEVENT',
        `UID:${task.id}@worksphere.io`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${dateStr}`,
        `SUMMARY:${escapeIcs(`[${task.priority.toUpperCase()}] ${task.title}`)}`,
        `DESCRIPTION:${escapeIcs(task.description || `Status: ${task.status}`)}`,
        `STATUS:${task.status === 'done' ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },
};
