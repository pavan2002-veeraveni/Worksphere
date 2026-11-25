import { Router } from 'express';
import activityRoutes from './activity.routes';
import adminRoutes from './admin.routes';
import authRoutes from './auth.routes';
import integrationRoutes from './integration.routes';
import notificationRoutes from './notification.routes';
import organizationRoutes from './organization.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import teamRoutes from './team.routes';
import workflowRoutes from './workflow.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/teams', teamRoutes);
router.use('/notifications', notificationRoutes);
router.use('/workflow-rules', workflowRoutes);
router.use('/integrations', integrationRoutes);
router.use('/admin', adminRoutes);
router.use('/', activityRoutes);

export default router;
