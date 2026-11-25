import { Router } from 'express';
import { organizationController } from '../../controllers/organizationController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';
import {
  createOrganizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from '../../validators/organization.validators';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /organizations:
 *   get:
 *     tags: [Organizations]
 *     summary: List organizations the current user belongs to
 *   post:
 *     tags: [Organizations]
 *     summary: Create a new organization
 */
router.get('/', organizationController.list);
router.post('/', validate(createOrganizationSchema), organizationController.create);

// Invitation acceptance doesn't require existing tenant membership
router.post('/invitations/:token/accept', organizationController.acceptInvitation);

router.get('/:orgId', tenantContext, organizationController.getById);
router.put(
  '/:orgId',
  tenantContext,
  authorize('owner'),
  validate(updateOrganizationSchema),
  organizationController.update,
);
router.delete('/:orgId', tenantContext, authorize('owner'), organizationController.remove);

router.get('/:orgId/members', tenantContext, organizationController.listMembers);
router.put(
  '/:orgId/members/:memberId',
  tenantContext,
  authorize('owner'),
  validate(updateMemberRoleSchema),
  organizationController.updateMemberRole,
);
router.delete(
  '/:orgId/members/:memberId',
  tenantContext,
  authorize('owner'),
  organizationController.removeMember,
);

router.get(
  '/:orgId/invitations',
  tenantContext,
  authorize('owner', 'project_manager'),
  organizationController.listInvitations,
);
router.post(
  '/:orgId/invitations',
  tenantContext,
  authorize('owner', 'project_manager'),
  validate(inviteMemberSchema),
  organizationController.inviteMember,
);
router.delete(
  '/:orgId/invitations/:invitationId',
  tenantContext,
  authorize('owner', 'project_manager'),
  organizationController.revokeInvitation,
);

export default router;
