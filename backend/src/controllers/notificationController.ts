import { Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { ApiError } from '../utils/ApiError';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const notificationController = {
  async list(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await notificationService.getUserNotifications(
      req.user!.id,
      req.tenant!.orgId,
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async unreadCount(req: Request, res: Response): Promise<Response> {
    const count = await notificationService.getUnreadCount(req.user!.id, req.tenant!.orgId);
    return successResponse(res, { unreadCount: count });
  },

  async markRead(req: Request, res: Response): Promise<Response> {
    const updated = await notificationService.markAsRead(
      req.user!.id,
      req.tenant!.orgId,
      String(req.params.id),
    );
    if (!updated) throw ApiError.notFound('Notification not found');
    return successResponse(res, updated);
  },

  async markAllRead(req: Request, res: Response): Promise<Response> {
    const count = await notificationService.markAllAsRead(req.user!.id, req.tenant!.orgId);
    return successResponse(res, { updatedCount: count });
  },
};
