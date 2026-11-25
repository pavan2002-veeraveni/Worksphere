import { Router } from 'express';
import { projectController } from '../../controllers/projectController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';
import {
  createMilestoneSchema,
  createProjectSchema,
  updateMilestoneSchema,
  updateProjectSchema,
} from '../../validators/project.validators';

const router = Router();

router.use(authenticate, tenantContext);

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List tenant projects with pagination and filtering
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project (owner or project_manager)
 */
router.get('/', projectController.list);
router.post(
  '/',
  authorize('owner', 'project_manager'),
  validate(createProjectSchema),
  projectController.create,
);

router.get('/:projectId', projectController.getById);
router.put(
  '/:projectId',
  authorize('owner', 'project_manager'),
  validate(updateProjectSchema),
  projectController.update,
);
router.delete('/:projectId', authorize('owner', 'project_manager'), projectController.remove);

router.get('/:projectId/calendar.ics', projectController.exportCalendarIcs);

router.get('/:projectId/milestones', projectController.listMilestones);
router.post(
  '/:projectId/milestones',
  authorize('owner', 'project_manager'),
  validate(createMilestoneSchema),
  projectController.createMilestone,
);
router.put(
  '/:projectId/milestones/:milestoneId',
  authorize('owner', 'project_manager'),
  validate(updateMilestoneSchema),
  projectController.updateMilestone,
);
router.delete(
  '/:projectId/milestones/:milestoneId',
  authorize('owner', 'project_manager'),
  projectController.deleteMilestone,
);

export default router;
