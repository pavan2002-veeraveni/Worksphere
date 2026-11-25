import { StatusCodes } from 'http-status-codes';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: unknown, code = 'BAD_REQUEST'): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, code, message, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED'): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, code, message);
  }

  static forbidden(message = 'Insufficient permissions', code = 'FORBIDDEN'): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, code, message);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND'): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, code, message);
  }

  static conflict(message: string, details?: unknown, code = 'CONFLICT'): ApiError {
    return new ApiError(StatusCodes.CONFLICT, code, message, details);
  }

  static tooManyRequests(message = 'Rate limit exceeded'): ApiError {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'RATE_LIMIT_EXCEEDED', message);
  }

  static serviceUnavailable(message = 'Service temporarily unavailable', details?: unknown): ApiError {
    return new ApiError(StatusCodes.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE', message, details);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'INTERNAL_ERROR', message, undefined, false);
  }
}
