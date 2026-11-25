import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { organizationService } from '../services/organizationService';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const organizationController = {
  async list(req: Request, res: Response): Promise<Response> {
    const orgs = await organizationService.listUserOrganizations(req.user!.id);
    return successResponse(res, orgs);
  },

  async getById(req: Request, res: Response): Promise<Response> {
    const org = await organizationService.getOrganization(req.tenant!.orgId);
    return successResponse(res, org);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const org = await organizationService.createOrganization(req.user!.id, req.body);
    return successResponse(res, org, StatusCodes.CREATED);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const org = await organizationService.updateOrganization(req.tenant!.orgId, req.user!.id, req.body);
    return successResponse(res, org);
  },

  async remove(req: Request, res: Response): Promise<Response> {
    await organizationService.deleteOrganization(req.tenant!.orgId);
    return successResponse(res, { deleted: true });
  },

  async listMembers(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await organizationService.listMembers(req.tenant!.orgId, limit, offset);
    return paginatedResponse(res, rows, page, limit, total);
  },

  async updateMemberRole(req: Request, res: Response): Promise<Response> {
    const updated = await organizationService.updateMemberRole(
      req.tenant!.orgId,
      String(req.params.memberId),
      req.body.role,
      req.user!.id,
    );
    return successResponse(res, updated);
  },

  async removeMember(req: Request, res: Response): Promise<Response> {
    await organizationService.removeMember(
      req.tenant!.orgId,
      String(req.params.memberId),
      req.user!.id,
    );
    return successResponse(res, { deleted: true });
  },

  async inviteMember(req: Request, res: Response): Promise<Response> {
    const invitation = await organizationService.inviteMember(
      req.tenant!.orgId,
      req.user!.id,
      req.body.email,
      req.body.role,
    );
    return successResponse(res, invitation, StatusCodes.CREATED);
  },

  async listInvitations(req: Request, res: Response): Promise<Response> {
    const invitations = await organizationService.listInvitations(req.tenant!.orgId);
    return successResponse(res, invitations);
  },

  async acceptInvitation(req: Request, res: Response): Promise<Response> {
    const member = await organizationService.acceptInvitation(
      String(req.params.token),
      req.user!.id,
      req.user!.email,
    );
    return successResponse(res, member);
  },

  async revokeInvitation(req: Request, res: Response): Promise<Response> {
    const invitation = await organizationService.revokeInvitation(
      req.tenant!.orgId,
      String(req.params.invitationId),
    );
    return successResponse(res, invitation);
  },
};
