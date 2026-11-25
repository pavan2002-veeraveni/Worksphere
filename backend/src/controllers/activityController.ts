import { Request, Response } from 'express';
import { activityService } from '../services/activityService';
import { auditService } from '../services/auditService';
import { paginatedResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const activityController = {
  async getTimeline(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await activityService.getActivityTimeline(
      req.tenant!.orgId,
      {
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        taskId: typeof req.query.taskId === 'string' ? req.query.taskId : undefined,
        actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
      },
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getTaskTimeline(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await activityService.getTaskActivity(
      req.tenant!.orgId,
      String(req.params.taskId),
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getAuditLog(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await auditService.getAuditLog(
      req.tenant!.orgId,
      {
        action: typeof req.query.action === 'string' ? req.query.action : undefined,
        resourceType: typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined,
        actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
      },
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },
};
