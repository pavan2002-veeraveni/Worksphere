import { Router } from 'express';
import { workflowController } from '../../controllers/workflowController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';
import {
  createWorkflowRuleSchema,
  updateWorkflowRuleSchema,
} from '../../validators/workflow.validators';

const router = Router();

router.use(authenticate, tenantContext);

router.get('/', workflowController.list);
router.post(
  '/',
  authorize('owner', 'project_manager'),
  validate(createWorkflowRuleSchema),
  workflowController.create,
);
router.get('/:ruleId', workflowController.getById);
router.put(
  '/:ruleId',
  authorize('owner', 'project_manager'),
  validate(updateWorkflowRuleSchema),
  workflowController.update,
);
router.delete('/:ruleId', authorize('owner', 'project_manager'), workflowController.remove);

export default router;
