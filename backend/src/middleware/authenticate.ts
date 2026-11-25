import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { requestContextStorage } from '../utils/logger';

interface JwtAccessPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  isPlatformAdmin: boolean;
  type: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or invalid Authorization header', 'MISSING_TOKEN');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw ApiError.unauthorized('Access token is empty', 'MISSING_TOKEN');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtAccessPayload;
    if (decoded.type !== 'access') {
      throw ApiError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
    }

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      firstName: decoded.firstName,
      lastName: decoded.lastName,
      isPlatformAdmin: Boolean(decoded.isPlatformAdmin),
    };

    const store = requestContextStorage.getStore();
    if (store) {
      store.userId = req.user.id;
    }

    next();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
}
