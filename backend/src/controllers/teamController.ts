import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { teamService } from '../services/teamService';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const teamController = {
  async list(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await teamService.list(req.tenant!.orgId, limit, offset);
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getById(req: Request, res: Response): Promise<Response> {
    const team = await teamService.getById(req.tenant!.orgId, String(req.params.teamId));
    return successResponse(res, team);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const team = await teamService.create(req.tenant!.orgId, req.body);
    return successResponse(res, team, StatusCodes.CREATED);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const team = await teamService.update(req.tenant!.orgId, String(req.params.teamId), req.body);
    return successResponse(res, team);
  },

  async remove(req: Request, res: Response): Promise<Response> {
    await teamService.remove(req.tenant!.orgId, String(req.params.teamId));
    return successResponse(res, { deleted: true });
  },

  async addMember(req: Request, res: Response): Promise<Response> {
    const member = await teamService.addMember(
      req.tenant!.orgId,
      String(req.params.teamId),
      req.body.userId,
      req.body.role,
    );
    return successResponse(res, member, StatusCodes.CREATED);
  },

  async removeMember(req: Request, res: Response): Promise<Response> {
    await teamService.removeMember(
      req.tenant!.orgId,
      String(req.params.teamId),
      String(req.params.userId),
    );
    return successResponse(res, { deleted: true });
  },
};
