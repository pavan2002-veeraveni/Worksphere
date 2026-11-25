import { Router } from 'express';
import { teamController } from '../../controllers/teamController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateTeamSchema,
} from '../../validators/team.validators';

const router = Router();

router.use(authenticate, tenantContext);

router.get('/', teamController.list);
router.post(
  '/',
  authorize('owner', 'project_manager'),
  validate(createTeamSchema),
  teamController.create,
);
router.get('/:teamId', teamController.getById);
router.put(
  '/:teamId',
  authorize('owner', 'project_manager'),
  validate(updateTeamSchema),
  teamController.update,
);
router.delete('/:teamId', authorize('owner', 'project_manager'), teamController.remove);
router.post(
  '/:teamId/members',
  authorize('owner', 'project_manager'),
  validate(addTeamMemberSchema),
  teamController.addMember,
);
router.delete(
  '/:teamId/members/:userId',
  authorize('owner', 'project_manager'),
  teamController.removeMember,
);

export default router;
