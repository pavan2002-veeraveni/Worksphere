import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requestContextStorage } from '../utils/logger';
import { metrics } from '../utils/metrics';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', () => {
    metrics.recordRequest(res.statusCode);
  });

  requestContextStorage.run({ requestId }, () => {
    next();
  });
}
