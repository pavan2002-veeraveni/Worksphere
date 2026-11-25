import 'express-async-errors';
import compression from 'compression';
import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import healthRoutes from './routes/health.routes';
import v1Routes from './routes/v1';
import { ApiError } from './utils/ApiError';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.use(compression());

  if (config.nodeEnv !== 'test') {
    app.use(
      morgan('combined', {
        stream: { write: (msg) => logger.info(msg.trim()) },
      }),
    );
  }

  // Raw body parser exclusively for Stripe webhook signature verification
  app.use('/api/v1/integrations/stripe/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.nodeEnv === 'test' ? 10000 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use('/api/', limiter);

  // Health, readiness, metrics & OpenAPI docs
  app.use('/', healthRoutes);
  app.get('/api-docs.json', (_req: Request, res: Response) => res.json(swaggerSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Versioned REST API
  app.use('/api/v1', v1Routes);

  // 404 catch-all
  app.use((req: Request) => {
    throw ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`, 'ROUTE_NOT_FOUND');
  });

  app.use(errorHandler);
  return app;
}

export const app = createApp();
export default app;
