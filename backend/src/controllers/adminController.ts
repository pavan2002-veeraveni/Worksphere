import { Request, Response } from 'express';
import { getDb } from '../config/database';
import { successResponse } from '../utils/apiResponse';

export const adminController = {
  async listAllOrganizations(_req: Request, res: Response): Promise<Response> {
    const orgs = await getDb()('organizations as o')
      .leftJoin('organization_members as om', 'om.org_id', 'o.id')
      .groupBy('o.id')
      .select('o.*')
      .count('om.id as member_count')
      .orderBy('o.created_at', 'desc');
    return successResponse(res, orgs);
  },

  async listAllUsers(_req: Request, res: Response): Promise<Response> {
    const users = await getDb()('users')
      .select(
        'id',
        'email',
        'first_name',
        'last_name',
        'is_platform_admin',
        'is_active',
        'last_login_at',
        'created_at',
      )
      .orderBy('created_at', 'desc');
    return successResponse(res, users);
  },

  async platformStats(_req: Request, res: Response): Promise<Response> {
    const db = getDb();
    const [orgsCount, usersCount, projectsCount, tasksCount] = await Promise.all([
      db('organizations').count<{ count: string }[]>('* as count').first(),
      db('users').count<{ count: string }[]>('* as count').first(),
      db('projects').count<{ count: string }[]>('* as count').first(),
      db('tasks').count<{ count: string }[]>('* as count').first(),
    ]);

    return successResponse(res, {
      organizations: Number(orgsCount?.count || 0),
      users: Number(usersCount?.count || 0),
      projects: Number(projectsCount?.count || 0),
      tasks: Number(tasksCount?.count || 0),
    });
  },
};
