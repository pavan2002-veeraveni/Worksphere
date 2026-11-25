import { Router } from 'express';
import { adminController } from '../../controllers/adminController';
import { authenticate } from '../../middleware/authenticate';
import { requirePlatformAdmin } from '../../middleware/authorize';

const router = Router();

router.use(authenticate, requirePlatformAdmin);

router.get('/organizations', adminController.listAllOrganizations);
router.get('/users', adminController.listAllUsers);
router.get('/stats', adminController.platformStats);

export default router;
