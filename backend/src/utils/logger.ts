import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';
import { config } from '../config';

interface RequestStore {
  requestId?: string;
  userId?: string;
  orgId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestStore>();

const correlationFormat = winston.format((info) => {
  const store = requestContextStorage.getStore();
  if (store?.requestId && !info.requestId) info.requestId = store.requestId;
  if (store?.userId && !info.userId) info.userId = store.userId;
  if (store?.orgId && !info.orgId) info.orgId = store.orgId;
  return info;
});

const redactSensitive = winston.format((info) => {
  const sensitiveKeys = ['password', 'password_hash', 'token', 'refreshToken', 'secret', 'authorization'];
  for (const key of sensitiveKeys) {
    if (key in info) {
      info[key] = '[REDACTED]';
    }
  }
  return info;
});

export const logger = winston.createLogger({
  level: config.nodeEnv === 'test' ? 'error' : config.logging.level,
  format: winston.format.combine(
    correlationFormat(),
    redactSensitive(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.logging.format === 'json' || config.nodeEnv === 'production'
      ? winston.format.json()
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  ),
  defaultMeta: { service: 'worksphere-api' },
  transports: [new winston.transports.Console()],
});
