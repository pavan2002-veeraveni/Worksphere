import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { errorResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';

interface PgError extends Error {
  code?: string;
  detail?: string;
  constraint?: string;
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  if (err instanceof ApiError) {
    if (err.statusCode >= 500) {
      logger.error(err.message, {
        errorCode: err.errorCode,
        path: req.originalUrl,
        method: req.method,
      });
    } else {
      logger.warn(err.message, {
        errorCode: err.errorCode,
        statusCode: err.statusCode,
        path: req.originalUrl,
      });
    }
    return errorResponse(res, err.statusCode, err.errorCode, err.message, err.details);
  }

  // Handle known PostgreSQL constraint errors cleanly
  const pgErr = err as PgError;
  if (pgErr.code === '23505') {
    return errorResponse(
      res,
      StatusCodes.CONFLICT,
      'DUPLICATE_RESOURCE',
      'A record with the provided unique identifier already exists',
    );
  }
  if (pgErr.code === '23503') {
    return errorResponse(
      res,
      StatusCodes.BAD_REQUEST,
      'INVALID_REFERENCE',
      'Referenced entity does not exist',
    );
  }
  if (pgErr.code === '22P02') {
    return errorResponse(
      res,
      StatusCodes.BAD_REQUEST,
      'INVALID_INPUT_SYNTAX',
      'Malformed identifier or input format',
    );
  }

  logger.error('Unhandled server error', {
    message: err.message,
    path: req.originalUrl,
    method: req.method,
    ...(config.nodeEnv !== 'production' ? { stack: err.stack } : {}),
  });

  // Never leak stack traces or internal details to end users
  return errorResponse(
    res,
    StatusCodes.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    'An unexpected error occurred',
  );
}
