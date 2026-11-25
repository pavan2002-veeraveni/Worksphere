import http from 'http';
import app from './app';
import { config } from './config';
import { closeDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { startAllWorkers, stopAllWorkers } from './jobs/scheduler';
import { logger } from './utils/logger';
import { closeSocketIO, initializeSocketIO } from './websocket/socketManager';

const server = http.createServer(app);
initializeSocketIO(server);

async function bootstrap(): Promise<void> {
  if (config.redis.enabled && config.nodeEnv !== 'test') {
    await startAllWorkers().catch((err) => {
      logger.warn('Background workers failed to start (Redis unavailable?)', {
        error: (err as Error).message,
      });
    });
  }

  server.listen(config.port, () => {
    logger.info(`WorkSphere API listening on port ${config.port}`, {
      environment: config.nodeEnv,
    });
  });
}

let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);

  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closeSocketIO();
    await stopAllWorkers();
    await closeDatabase();
    await closeRedis();
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (!config.isVercel) {
  bootstrap().catch((err) => {
    logger.error('Failed to start server', { error: (err as Error).message });
    process.exit(1);
  });
}

export default server;
