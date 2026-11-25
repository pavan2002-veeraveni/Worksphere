import { Job, Worker } from 'bullmq';
import { config } from '../../config';
import { getDb } from '../../config/database';
import { emailService } from '../../integrations/emailService';
import { withIdempotency } from '../../utils/idempotency';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { emitToUser } from '../../websocket/socketManager';
import { deadLetterHandler } from '../deadLetterHandler';
import { QUEUE_NAMES } from '../queue';

export interface NotificationJobPayload {
  idempotencyKey: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
  sendEmail?: boolean;
  recipientEmail?: string;
}

/**
 * Processes a notification job idempotently so worker restarts or BullMQ retries
 * never create duplicate notification rows or send duplicate emails.
 */
export async function processNotificationJob(payload: NotificationJobPayload): Promise<{ skipped: boolean }> {
  const db = getDb();
  const res = await withIdempotency(db, payload.idempotencyKey, `notification:${payload.type}`, async () => {
    const [notification] = await db('notifications')
      .insert({
        org_id: payload.orgId,
        user_id: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link || null,
        metadata: JSON.stringify(payload.metadata || {}),
      })
      .returning('*');

    emitToUser(payload.userId, 'notification:new', notification);

    if (payload.sendEmail && payload.recipientEmail) {
      await emailService.sendNotificationEmail(payload.recipientEmail, payload.title, payload.message);
    }

    metrics.recordJobProcessed();
    return { notificationId: notification.id };
  });

  if (res.skipped) {
    logger.info('Duplicate notification job skipped via idempotency guard', {
      idempotencyKey: payload.idempotencyKey,
    });
  }

  return { skipped: res.skipped };
}

export function startNotificationWorker(): Worker<NotificationJobPayload> {
  const worker = new Worker<NotificationJobPayload>(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job<NotificationJobPayload>) => processNotificationJob(job.data),
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    },
  );

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await deadLetterHandler.recordFailure({
        queueName: QUEUE_NAMES.NOTIFICATION,
        jobId: String(job.id),
        jobName: job.name,
        orgId: job.data?.orgId,
        payload: job.data as unknown as Record<string, unknown>,
        error: err,
        attemptsMade: job.attemptsMade,
      });
    }
  });

  return worker;
}
