import { Worker } from 'bullmq';
import { closeDatabase, getDb } from '../config/database';
import { closeRedis } from '../config/redis';
import { logger } from '../utils/logger';
import { closeAllQueues, enqueueJob, getQueue, QUEUE_NAMES } from './queue';
import { startAnalyticsWorker } from './workers/analyticsWorker';
import { startNotificationWorker } from './workers/notificationWorker';
import { startReminderWorker } from './workers/reminderWorker';
import { startWebhookWorker } from './workers/webhookWorker';

const workers: Worker[] = [];

export async function registerRepeatableJobs(): Promise<void> {
  const reminderQueue = getQueue(QUEUE_NAMES.REMINDER);
  if (reminderQueue) {
    await reminderQueue.add(
      'daily-overdue-reminders',
      { windowHours: 24 },
      { repeat: { pattern: '0 8 * * *' }, jobId: 'daily-overdue-reminders' },
    );
  }
}

export async function cleanupExpiredRecords(): Promise<{ expiredInvites: number; expiredTokens: number }> {
  const db = getDb();
  const expiredInvites = await db('invitations')
    .where('status', 'pending')
    .andWhere('expires_at', '<', db.fn.now())
    .update({ status: 'expired' });

  const expiredTokens = await db('refresh_tokens')
    .where('expires_at', '<', db.fn.now())
    .del();

  return { expiredInvites, expiredTokens };
}

export async function startAllWorkers(): Promise<void> {
  workers.push(
    startNotificationWorker(),
    startReminderWorker(),
    startAnalyticsWorker(),
    startWebhookWorker(),
  );
  await registerRepeatableJobs();
  logger.info('All BullMQ workers started', { count: workers.length });
}

export async function stopAllWorkers(): Promise<void> {
  logger.info('Stopping BullMQ workers gracefully...');
  await Promise.all(workers.map((w) => w.close()));
  workers.length = 0;
  await closeAllQueues();
}

// Allow standalone worker process execution (used by docker-compose worker service)
if (require.main === module) {
  startAllWorkers()
    .then(() => {
      // Trigger an initial reminder sweep check if configured
      return enqueueJob(QUEUE_NAMES.REMINDER, 'startup-reminder-check', { windowHours: 24 });
    })
    .catch((err) => {
      logger.error('Worker bootstrap failed', { error: (err as Error).message });
      process.exit(1);
    });

  const shutdown = async () => {
    await stopAllWorkers();
    await closeDatabase();
    await closeRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
