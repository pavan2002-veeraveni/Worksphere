import { Job, Worker } from 'bullmq';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { metrics } from '../../utils/metrics';
import { deadLetterHandler } from '../deadLetterHandler';
import { QUEUE_NAMES } from '../queue';

export interface AnalyticsSyncPayload {
  orgId: string;
  projectId?: string;
}

export async function processAnalyticsJob(payload: AnalyticsSyncPayload): Promise<{ synced: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.analytics.timeoutMs);

  try {
    const res = await fetch(
      `${config.analytics.url}/api/v1/analytics/summary?org_id=${encodeURIComponent(payload.orgId)}`,
      {
        headers: { 'X-API-Key': config.analytics.apiKey },
        signal: controller.signal,
      },
    );

    if (!res.ok) {
      throw new Error(`Analytics service returned HTTP ${res.status}`);
    }

    metrics.recordJobProcessed();
    return { synced: true };
  } catch (err) {
    logger.warn('Analytics sync job failed', { orgId: payload.orgId, error: (err as Error).message });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function startAnalyticsWorker(): Worker<AnalyticsSyncPayload> {
  const worker = new Worker<AnalyticsSyncPayload>(
    QUEUE_NAMES.ANALYTICS,
    async (job: Job<AnalyticsSyncPayload>) => processAnalyticsJob(job.data),
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: null,
      },
      concurrency: 3,
    },
  );

  worker.on('failed', async (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      await deadLetterHandler.recordFailure({
        queueName: QUEUE_NAMES.ANALYTICS,
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
