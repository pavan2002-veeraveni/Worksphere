import { Job, Worker } from 'bullmq';
import { config } from '../../config';
import { getDb } from '../../config/database';
import { webhookService } from '../../integrations/webhookService';
import { withIdempotency } from '../../utils/idempotency';
import { metrics } from '../../utils/metrics';
import { deadLetterHandler } from '../deadLetterHandler';
import { QUEUE_NAMES } from '../queue';

export interface WebhookJobPayload {
  deliveryId: string;
  webhookId: string;
  orgId: string;
  url: string;
  secret: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export async function processWebhookJob(data: WebhookJobPayload): Promise<{ skipped: boolean; statusCode?: number }> {
  const db = getDb();
  const res = await withIdempotency(db, `webhook:${data.deliveryId}`, data.eventType, async () => {
    const result = await webhookService.deliverToEndpoint(
      data.url,
      data.secret,
      data.eventType,
      data.deliveryId,
      data.payload,
    );

    const isSuccess = result.statusCode >= 200 && result.statusCode < 300;
    await db('webhook_deliveries')
      .insert({
        webhook_id: data.webhookId,
        org_id: data.orgId,
        event_type: data.eventType,
        delivery_id: data.deliveryId,
        payload: JSON.stringify(data.payload),
        status_code: result.statusCode,
        response_body: result.body,
        status: isSuccess ? 'delivered' : 'failed',
        delivered_at: isSuccess ? db.fn.now() : null,
      })
      .onConflict('delivery_id')
      .merge({
        status_code: result.statusCode,
        response_body: result.body,
        status: isSuccess ? 'delivered' : 'failed',
        delivered_at: isSuccess ? db.fn.now() : null,
      });

    if (!isSuccess) {
      throw new Error(`Webhook endpoint responded with status ${result.statusCode}`);
    }

    metrics.recordJobProcessed();
    return { statusCode: result.statusCode };
  });

  return { skipped: res.skipped, statusCode: res.result?.statusCode };
}

export function startWebhookWorker(): Worker<WebhookJobPayload> {
  const worker = new Worker<WebhookJobPayload>(
    QUEUE_NAMES.WEBHOOK,
    async (job: Job<WebhookJobPayload>) => processWebhookJob(job.data),
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
        queueName: QUEUE_NAMES.WEBHOOK,
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
