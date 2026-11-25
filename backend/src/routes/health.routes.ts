import { Request, Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { metrics } from '../utils/metrics';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'healthy',
    service: 'worksphere-api',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

router.get('/ready', async (_req: Request, res: Response) => {
  const dbOk = await checkDatabaseHealth();
  const redisRequired = config.redis.enabled && config.nodeEnv !== 'test';
  const redisOk = redisRequired ? await checkRedisHealth() : true;
  const ready = dbOk && redisOk;

  res.status(ready ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE).json({
    status: ready ? 'ready' : 'degraded',
    checks: {
      database: dbOk ? 'up' : 'down',
      redis: redisRequired ? (redisOk ? 'up' : 'down') : 'disabled',
    },
  });
});

router.get('/metrics', (req: Request, res: Response) => {
  if (req.header('accept')?.includes('application/json')) {
    return res.status(StatusCodes.OK).json(metrics.snapshot());
  }
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  return res.status(StatusCodes.OK).send(metrics.toPrometheus());
});

export default router;
