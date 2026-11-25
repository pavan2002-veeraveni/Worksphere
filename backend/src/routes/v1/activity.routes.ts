import { Router } from 'express';
import { activityController } from '../../controllers/activityController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';

const router = Router();

router.use(authenticate, tenantContext);

router.get('/activity', activityController.getTimeline);
router.get('/activity/tasks/:taskId', activityController.getTaskTimeline);
router.get('/audit-log', authorize('owner', 'auditor'), activityController.getAuditLog);

export default router;
