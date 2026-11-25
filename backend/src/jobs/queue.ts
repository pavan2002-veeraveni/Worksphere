import { JobsOptions, Queue } from 'bullmq';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export const QUEUE_NAMES = {
  NOTIFICATION: 'notifications',
  REMINDER: 'reminders',
  ANALYTICS: 'analytics',
  WEBHOOK: 'webhooks',
  WORKFLOW: 'workflows',
} as const;

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: 500,
  removeOnFail: 1000,
};

let queuesInitialized = false;
const queueMap = new Map<string, Queue>();

function createQueue(name: string): Queue | null {
  const redis = getRedisClient();
  if (!redis || config.nodeEnv === 'test') {
    return null;
  }

  const queue = new Queue(name, {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
    },
    defaultJobOptions,
  });

  queue.on('error', (err) => {
    logger.warn('Queue error', { queue: name, error: err.message });
  });

  return queue;
}

export function getQueue(name: string): Queue | null {
  if (!queuesInitialized) {
    queuesInitialized = true;
    for (const qName of Object.values(QUEUE_NAMES)) {
      const q = createQueue(qName);
      if (q) queueMap.set(qName, q);
    }
  }
  return queueMap.get(name) || null;
}

export async function enqueueJob<T extends Record<string, unknown>>(
  queueName: string,
  jobName: string,
  data: T,
  options?: JobsOptions,
): Promise<{ queued: boolean; jobId?: string }> {
  const queue = getQueue(queueName);
  if (!queue) {
    logger.debug('Queue unavailable (test/no-redis mode), skipping async enqueue', {
      queueName,
      jobName,
    });
    return { queued: false };
  }

  try {
    const job = await queue.add(jobName, data, options);
    return { queued: true, jobId: job.id };
  } catch (err) {
    logger.warn('Failed to enqueue job, degraded gracefully', {
      queueName,
      jobName,
      error: (err as Error).message,
    });
    return { queued: false };
  }
}

export async function closeAllQueues(): Promise<void> {
  for (const queue of queueMap.values()) {
    await queue.close().catch(() => undefined);
  }
  queueMap.clear();
  queuesInitialized = false;
}
