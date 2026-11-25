import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError';

type ValidationTarget = 'body' | 'params' | 'query';

export function validate(schema: ZodSchema, source: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        }));
        throw ApiError.badRequest('Validation failed', details, 'VALIDATION_ERROR');
      }
      throw err;
    }
  };
}
