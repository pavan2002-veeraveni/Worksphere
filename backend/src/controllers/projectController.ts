import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { calendarService } from '../integrations/calendarService';
import { taskRepository } from '../repositories/taskRepository';
import { projectService } from '../services/projectService';
import { paginatedResponse, successResponse } from '../utils/apiResponse';
import { parsePagination } from '../utils/pagination';

export const projectController = {
  async list(req: Request, res: Response): Promise<Response> {
    const { page, limit, offset } = parsePagination(req.query);
    const { rows, total } = await projectService.list(
      req.tenant!.orgId,
      {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      },
      limit,
      offset,
    );
    return paginatedResponse(res, rows, page, limit, total);
  },

  async getById(req: Request, res: Response): Promise<Response> {
    const project = await projectService.getById(req.tenant!.orgId, String(req.params.projectId));
    return successResponse(res, project);
  },

  async create(req: Request, res: Response): Promise<Response> {
    const project = await projectService.create(req.tenant!.orgId, req.user!.id, req.body);
    return successResponse(res, project, StatusCodes.CREATED);
  },

  async update(req: Request, res: Response): Promise<Response> {
    const { version, ...rest } = req.body;
    const updated = await projectService.update(
      req.tenant!.orgId,
      String(req.params.projectId),
      req.user!.id,
      version,
      rest,
    );
    return successResponse(res, updated);
  },

  async remove(req: Request, res: Response): Promise<Response> {
    await projectService.remove(req.tenant!.orgId, String(req.params.projectId), req.user!.id);
    return successResponse(res, { deleted: true });
  },

  async listMilestones(req: Request, res: Response): Promise<Response> {
    const milestones = await projectService.listMilestones(
      req.tenant!.orgId,
      String(req.params.projectId),
    );
    return successResponse(res, milestones);
  },

  async createMilestone(req: Request, res: Response): Promise<Response> {
    const milestone = await projectService.createMilestone(
      req.tenant!.orgId,
      String(req.params.projectId),
      req.body,
    );
    return successResponse(res, milestone, StatusCodes.CREATED);
  },

  async updateMilestone(req: Request, res: Response): Promise<Response> {
    const milestone = await projectService.updateMilestone(
      req.tenant!.orgId,
      String(req.params.projectId),
      String(req.params.milestoneId),
      req.body,
    );
    return successResponse(res, milestone);
  },

  async deleteMilestone(req: Request, res: Response): Promise<Response> {
    await projectService.deleteMilestone(
      req.tenant!.orgId,
      String(req.params.projectId),
      String(req.params.milestoneId),
    );
    return successResponse(res, { deleted: true });
  },

  async exportCalendarIcs(req: Request, res: Response): Promise<Response> {
    const project = await projectService.getById(req.tenant!.orgId, String(req.params.projectId));
    const { rows } = await taskRepository.findByOrg(
      req.tenant!.orgId,
      { projectId: project.id },
      100,
      0,
    );
    const ics = calendarService.generateProjectIcs(
      project.name,
      rows.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        dueDate: t.due_date ? String(t.due_date) : '',
        status: t.status,
        priority: t.priority,
      })),
    );
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${project.id}.ics"`);
    return res.status(StatusCodes.OK).send(ics);
  },
};
