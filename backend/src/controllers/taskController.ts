import crypto from 'crypto';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { config } from '../config';
import { storageService } from '../integrations/storageService';
import { taskService } from '../services/taskService';
import { ApiError } from '../utils/ApiError';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const taskController = {
  async list(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await taskService.list(
      req.tenant!.orgId,
      {
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        assigneeId: typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      },
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getById(req: Request, res: Response): Promise<Response> {
    const task = await taskService.getById(req.tenant!.orgId, String(req.params.taskId));
    return successResponse(res, task);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const task = await taskService.create(req.tenant!.orgId, req.user!.id, req.body);
    return successResponse(res, task, StatusCodes.CREATED);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const { version, ...rest } = req.body;
    const updated = await taskService.update(
      req.tenant!.orgId,
      String(req.params.taskId),
      req.user!.id,
      version,
      rest,
      {
        ipAddress: req.ip,
        userAgent: req.header('user-agent'),
        requestId: req.requestId,
      },
    );
    return successResponse(res, updated);
  },

  async remove(req: Request, res: Response): Promise<Response> {
    await taskService.remove(req.tenant!.orgId, String(req.params.taskId), req.user!.id);
    return successResponse(res, { deleted: true });
  },

  async listSubtasks(req: Request, res: Response): Promise<Response> {
    const subtasks = await taskService.listSubtasks(req.tenant!.orgId, String(req.params.taskId));
    return successResponse(res, subtasks);
  },

  async createSubtask(req: Request, res: Response): Promise<Response> {
    const subtask = await taskService.createSubtask(
      req.tenant!.orgId,
      String(req.params.taskId),
      req.user!.id,
      req.body,
    );
    return successResponse(res, subtask, StatusCodes.CREATED);
  },

  async listComments(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await taskService.listComments(
      req.tenant!.orgId,
      String(req.params.taskId),
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async createComment(req: Request, res: Response): Promise<Response> {
    const comment = await taskService.createComment(
      req.tenant!.orgId,
      String(req.params.taskId),
      req.user!.id,
      req.body.content,
      req.body.parentCommentId,
    );
    return successResponse(res, comment, StatusCodes.CREATED);
  },

  async updateComment(req: Request, res: Response): Promise<Response> {
    const comment = await taskService.updateComment(
      req.tenant!.orgId,
      String(req.params.taskId),
      String(req.params.commentId),
      req.user!.id,
      req.body.content,
    );
    return successResponse(res, comment);
  },

  async deleteComment(req: Request, res: Response): Promise<Response> {
    await taskService.deleteComment(
      req.tenant!.orgId,
      String(req.params.taskId),
      String(req.params.commentId),
    );
    return successResponse(res, { deleted: true });
  },

  async uploadAttachment(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      throw ApiError.badRequest('File attachment is required');
    }
    const attachment = await taskService.uploadAttachment(
      req.tenant!.orgId,
      String(req.params.taskId),
      req.user!.id,
      req.file,
    );
    return successResponse(res, attachment, StatusCodes.CREATED);
  },

  async downloadLocalAttachment(req: Request, res: Response): Promise<Response> {
    const key = String(req.query.key || '');
    const expires = Number(req.query.expires || 0);
    const sig = String(req.query.sig || '');

    if (!key || !expires || !sig || expires < Math.floor(Date.now() / 1000)) {
      throw ApiError.forbidden('Signed attachment link expired or invalid');
    }

    const expectedSig = crypto
      .createHmac('sha256', config.jwt.secret)
      .update(`${storageService.sanitizeKey(key)}:${expires}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw ApiError.forbidden('Invalid attachment signature');
    }

    try {
      const data = await storageService.downloadFile(key);
      const fileName = key.split('/').pop()?.replace(/["\r\n]/g, '_') || 'attachment';
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.status(StatusCodes.OK).send(data);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw ApiError.notFound('Attachment file not found');
      }
      throw err;
    }
  },

  async addWatcher(req: Request, res: Response): Promise<Response> {
    const watchers = await taskService.addWatcher(
      req.tenant!.orgId,
      String(req.params.taskId),
      req.user!.id,
    );
    return successResponse(res, watchers);
  },

  async removeWatcher(req: Request, res: Response): Promise<Response> {
    await taskService.removeWatcher(req.tenant!.orgId, String(req.params.taskId), req.user!.id);
    return successResponse(res, { removed: true });
  },
};
