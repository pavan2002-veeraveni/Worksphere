import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (!config.redis.enabled || config.nodeEnv === 'test') {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 200, 3000);
      },
    });

    redisClient.on('error', (err) => {
      logger.warn('Redis connection error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis');
    });
  }

  return redisClient;
}

export async function checkRedisHealth(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) {
    return false;
  }
  try {
    const res = await client.ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit().catch(() => undefined);
    redisClient = null;
  }
}
