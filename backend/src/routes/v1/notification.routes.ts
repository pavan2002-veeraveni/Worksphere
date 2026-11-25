import { Router } from 'express';
import { notificationController } from '../../controllers/notificationController';
import { authenticate } from '../../middleware/authenticate';
import { tenantContext } from '../../middleware/tenantContext';

const router = Router();

router.use(authenticate, tenantContext);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', notificationController.markRead);

export default router;
