import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { stripeService } from '../integrations/stripeService';
import { webhookService } from '../integrations/webhookService';
import { deadLetterHandler } from '../jobs/deadLetterHandler';
import { enqueueJob } from '../jobs/queue';
import { analyticsProxyService } from '../services/analyticsProxyService';
import { organizationService } from '../services/organizationService';
import { ApiError } from '../utils/ApiError';
import { successResponse } from '../utils/apiResponse';

export const integrationController = {
  async listWebhooks(req: Request, res: Response): Promise<Response> {
    const hooks = await webhookService.listWebhooks(req.tenant!.orgId);
    return successResponse(res, hooks);
  },

  async createWebhook(req: Request, res: Response): Promise<Response> {
    const hook = await webhookService.registerWebhook(req.tenant!.orgId, req.user!.id, req.body);
    return successResponse(res, hook, StatusCodes.CREATED);
  },

  async deleteWebhook(req: Request, res: Response): Promise<Response> {
    const ok = await webhookService.deleteWebhook(req.tenant!.orgId, String(req.params.webhookId));
    if (!ok) throw ApiError.notFound('Webhook not found');
    return successResponse(res, { deleted: true });
  },

  async subscribeOrg(req: Request, res: Response): Promise<Response> {
    const org = await organizationService.getOrganization(req.tenant!.orgId);
    const { customerId } = await stripeService.createCustomer(org.id, org.name, req.user!.email);
    const sub = await stripeService.createSubscription(
      org.id,
      customerId,
      req.body.priceId,
      req.body.plan || 'professional',
    );
    return successResponse(res, sub, StatusCodes.CREATED);
  },

  async handleStripeWebhook(req: Request, res: Response): Promise<Response> {
    const signature = req.header('stripe-signature') || '';
    const rawBody = Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body);
    const result = await stripeService.handleWebhook(rawBody, signature);
    return successResponse(res, result);
  },

  async listDeadLetterJobs(req: Request, res: Response): Promise<Response> {
    const jobs = await deadLetterHandler.listDeadLetterJobs(
      req.tenant?.orgId,
      typeof req.query.status === 'string' ? req.query.status : undefined,
    );
    return successResponse(res, jobs);
  },

  async retryDeadLetterJob(req: Request, res: Response): Promise<Response> {
    const jobs = await deadLetterHandler.listDeadLetterJobs(req.tenant?.orgId);
    const target = jobs.find((j) => j.id === req.params.id);
    if (!target) throw ApiError.notFound('Dead-letter job not found');

    const payload =
      typeof target.payload === 'string' ? JSON.parse(target.payload) : target.payload;
    await enqueueJob(target.queue_name, target.job_name, payload);
    const updated = await deadLetterHandler.markRetried(target.id);
    return successResponse(res, updated);
  },

  async analyticsSummary(req: Request, res: Response): Promise<Response> {
    const summary = await analyticsProxyService.getSummary(req.tenant!.orgId);
    return successResponse(res, summary);
  },

  async analyticsWorkload(req: Request, res: Response): Promise<Response> {
    const workload = await analyticsProxyService.getWorkload(req.tenant!.orgId);
    return successResponse(res, workload);
  },

  async analyticsProjectHealth(req: Request, res: Response): Promise<Response> {
    const health = await analyticsProxyService.getProjectHealth(
      req.tenant!.orgId,
      String(req.params.projectId),
    );
    return successResponse(res, health);
  },
};
