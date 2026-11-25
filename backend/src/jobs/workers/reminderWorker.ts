import { Job, Worker } from 'bullmq';
import { config } from '../../config';
import { getDb } from '../../config/database';
import { generateIdempotencyKey } from '../../utils/idempotency';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { deadLetterHandler } from '../deadLetterHandler';
import { QUEUE_NAMES } from '../queue';
import { processNotificationJob } from './notificationWorker';

export interface ReminderJobPayload {
  windowHours?: number;
}

export async function processReminderJob(payload: ReminderJobPayload = {}): Promise<{ remindersQueued: number }> {
  const db = getDb();
  const windowHours = payload.windowHours ?? 24;
  const targetDate = new Date(Date.now() + windowHours * 3600 * 1000).toISOString().slice(0, 10);

  const dueTasks = await db('tasks as t')
    .join('projects as p', 'p.id', 't.project_id')
    .leftJoin('users as u', 'u.id', 't.assignee_id')
    .whereNotIn('t.status', ['done', 'cancelled'])
    .whereNotNull('t.assignee_id')
    .whereNotNull('t.due_date')
    .andWhere('t.due_date', '<=', targetDate)
    .select(
      't.id',
      't.title',
      't.due_date',
      't.assignee_id',
      'p.org_id',
      'p.id as project_id',
      'u.email as assignee_email',
    );

  let sent = 0;
  for (const task of dueTasks) {
    const dueStr =
      task.due_date instanceof Date
        ? task.due_date.toISOString().slice(0, 10)
        : String(task.due_date).slice(0, 10);
    const idempotencyKey = generateIdempotencyKey('reminder', task.id, dueStr);
    const res = await processNotificationJob({
      idempotencyKey,
      orgId: task.org_id,
      userId: task.assignee_id,
      type: 'deadline_approaching',
      title: `Task due soon: ${task.title}`,
      message: `Task "${task.title}" has a due date of ${dueStr}.`,
      link: `/projects/${task.project_id}`,
      sendEmail: Boolean(task.assignee_email),
      recipientEmail: task.assignee_email || undefined,
    });
    if (!res.skipped) sent += 1;
  }

  metrics.recordJobProcessed();
  logger.info('Reminder sweep completed', { scanned: dueTasks.length, sent });
  return { remindersQueued: sent };
}

export function startReminderWorker(): Worker<ReminderJobPayload> {
  const worker = new Worker<ReminderJobPayload>(
    QUEUE_NAMES.REMINDER,
    async (job: Job<ReminderJobPayload>) => processReminderJob(job.data),
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      },
      concurrency: 2,
    },
  );

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await deadLetterHandler.recordFailure({
        queueName: QUEUE_NAMES.REMINDER,
        jobId: String(job.id),
        jobName: job.name,
        payload: job.data as unknown as Record<string, unknown>,
        error: err,
        attemptsMade: job.attemptsMade,
      });
    }
  });

  return worker;
}
