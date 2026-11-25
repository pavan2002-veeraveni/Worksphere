import { NextFunction, Request, Response } from 'express';
import { getDb } from '../config/database';
import { OrgRole } from '../types/express';
import { ApiError } from '../utils/ApiError';
import { requestContextStorage } from '../utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extracts orgId from route params (:orgId), header (X-Org-ID), or query (?orgId=),
 * verifies that the authenticated user is a member of that tenant (or a platform admin),
 * and binds req.tenant for strict server-side multi-tenant isolation.
 */
export async function tenantContext(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    throw ApiError.unauthorized();
  }

  const rawOrgId =
    (req.params.orgId as string | undefined) ||
    req.header('x-org-id') ||
    (typeof req.query.orgId === 'string' ? req.query.orgId : undefined);

  if (!rawOrgId) {
    throw ApiError.badRequest('Organization context (orgId or X-Org-ID) is required', undefined, 'MISSING_TENANT');
  }

  if (!UUID_REGEX.test(rawOrgId)) {
    throw ApiError.badRequest('Invalid organization ID format', undefined, 'INVALID_TENANT_ID');
  }

  const db = getDb();
  const membership = await db('organization_members')
    .where({ org_id: rawOrgId, user_id: req.user.id })
    .first<{ role: OrgRole }>('role');

  if (!membership) {
    if (req.user.isPlatformAdmin) {
      req.tenant = { orgId: rawOrgId, role: 'platform_admin' };
      return next();
    }
    throw ApiError.forbidden('You do not have access to this organization', 'TENANT_ACCESS_DENIED');
  }

  req.tenant = {
    orgId: rawOrgId,
    role: membership.role,
  };

  const store = requestContextStorage.getStore();
  if (store) {
    store.orgId = rawOrgId;
  }

  next();
}
