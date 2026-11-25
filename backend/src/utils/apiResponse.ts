import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StandardResponse<T = unknown> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId?: string;
}

export function successResponse<T>(
  res: Response,
  data: T,
  statusCode: number = StatusCodes.OK,
  meta?: PaginationMeta,
): Response {
  const payload: StandardResponse<T> = {
    success: true,
    data,
    requestId: res.req?.requestId,
  };
  if (meta) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
}

export function paginatedResponse<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
): Response {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return successResponse(res, data, StatusCodes.OK, {
    page,
    limit,
    total,
    totalPages,
  });
}

export function errorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  const payload: StandardResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    requestId: res.req?.requestId,
  };
  return res.status(statusCode).json(payload);
}
