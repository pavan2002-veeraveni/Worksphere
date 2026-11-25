import { NextFunction, Request, Response } from 'express';
import { OrgRole } from '../types/express';
import { ApiError } from '../utils/ApiError';

export type AllowedRole = OrgRole | 'platform_admin';

export function authorize(...allowedRoles: AllowedRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw ApiError.unauthorized();
    }

    if (req.user.isPlatformAdmin) {
      return next();
    }

    if (!req.tenant) {
      throw ApiError.forbidden('Tenant context is required for authorization', 'MISSING_TENANT_CONTEXT');
    }

    if (!allowedRoles.includes(req.tenant.role)) {
      throw ApiError.forbidden(
        `Role '${req.tenant.role}' is not permitted to perform this action`,
        'ROLE_FORBIDDEN',
      );
    }

    next();
  };
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  if (!req.user.isPlatformAdmin) {
    throw ApiError.forbidden('Platform administrator privileges required', 'PLATFORM_ADMIN_REQUIRED');
  }
  next();
}
