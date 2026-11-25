import { Router } from 'express';
import { z } from 'zod';
import { integrationController } from '../../controllers/integrationController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';

const createWebhookSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().url('Valid HTTPS/HTTP webhook URL is required'),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().min(16).optional(),
});

const subscribeSchema = z.object({
  priceId: z.string().min(1).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).default('professional'),
});

const router = Router();

// Stripe webhook uses signature verification instead of JWT
router.post('/stripe/webhook', integrationController.handleStripeWebhook);

router.use(authenticate, tenantContext);

router.get('/webhooks', authorize('owner', 'project_manager'), integrationController.listWebhooks);
router.post(
  '/webhooks',
  authorize('owner'),
  validate(createWebhookSchema),
  integrationController.createWebhook,
);
router.delete('/webhooks/:webhookId', authorize('owner'), integrationController.deleteWebhook);

router.post(
  '/billing/subscribe',
  authorize('owner'),
  validate(subscribeSchema),
  integrationController.subscribeOrg,
);

router.get('/dead-letter', authorize('owner'), integrationController.listDeadLetterJobs);
router.post('/dead-letter/:id/retry', authorize('owner'), integrationController.retryDeadLetterJob);

router.get('/analytics/summary', integrationController.analyticsSummary);
router.get('/analytics/workload', integrationController.analyticsWorkload);
router.get('/analytics/projects/:projectId/health', integrationController.analyticsProjectHealth);

export default router;
