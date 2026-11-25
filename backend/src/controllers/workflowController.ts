import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { workflowRuleService } from '../services/workflowRuleService';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const workflowController = {
  async list(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await workflowRuleService.list(req.tenant!.orgId, limit, offset);
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getById(req: Request, res: Response): Promise<Response> {
    const rule = await workflowRuleService.getById(req.tenant!.orgId, String(req.params.ruleId));
    return successResponse(res, rule);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const rule = await workflowRuleService.create(req.tenant!.orgId, req.user!.id, req.body);
    return successResponse(res, rule, StatusCodes.CREATED);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const rule = await workflowRuleService.update(
      req.tenant!.orgId,
      String(req.params.ruleId),
      req.body,
    );
    return successResponse(res, rule);
  },

  async remove(req: Request, res: Response): Promise<Response> {
    await workflowRuleService.remove(req.tenant!.orgId, String(req.params.ruleId));
    return successResponse(res, { deleted: true });
  },
};
