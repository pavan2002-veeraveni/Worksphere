import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { authService } from '../services/authService';
import { successResponse } from '../utils/apiResponse';

export const authController = {
  async register(req: Request, res: Response): Promise<Response> {
    const result = await authService.register(req.body);
    return successResponse(res, result, StatusCodes.CREATED);
  },

  async login(req: Request, res: Response): Promise<Response> {
    const { email, password, role } = req.body;
    const result = await authService.login(email, password, role);
    return successResponse(res, result, StatusCodes.OK);
  },

  async refreshToken(req: Request, res: Response): Promise<Response> {
    const tokens = await authService.refreshToken(req.body.refreshToken);
    return successResponse(res, tokens, StatusCodes.OK);
  },

  async logout(req: Request, res: Response): Promise<Response> {
    await authService.logout(req.user!.id, req.body?.refreshToken);
    return successResponse(res, { message: 'Logged out successfully' }, StatusCodes.OK);
  },

  async me(req: Request, res: Response): Promise<Response> {
    const profile = await authService.getProfile(req.user!.id);
    return successResponse(res, profile, StatusCodes.OK);
  },
};
