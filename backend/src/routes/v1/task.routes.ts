import { Router } from 'express';
import multer from 'multer';
import { taskController } from '../../controllers/taskController';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { tenantContext } from '../../middleware/tenantContext';
import { validate } from '../../middleware/validate';
import {
  createCommentSchema,
  createTaskSchema,
  updateCommentSchema,
  updateTaskSchema,
} from '../../validators/task.validators';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

// Signed local storage download endpoint (signature-verified)
router.get('/attachments/download', taskController.downloadLocalAttachment);

router.use(authenticate, tenantContext);

/**
 * @openapi
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: List tenant tasks with filtering and pagination
 *   post:
 *     tags: [Tasks]
 *     summary: Create a task
 */
router.get('/', taskController.list);
router.post(
  '/',
  authorize('owner', 'project_manager', 'team_member'),
  validate(createTaskSchema),
  taskController.create,
);

router.get('/:taskId', taskController.getById);
router.put(
  '/:taskId',
  authorize('owner', 'project_manager', 'team_member'),
  validate(updateTaskSchema),
  taskController.update,
);
router.delete(
  '/:taskId',
  authorize('owner', 'project_manager'),
  taskController.remove,
);

router.get('/:taskId/subtasks', taskController.listSubtasks);
router.post(
  '/:taskId/subtasks',
  authorize('owner', 'project_manager', 'team_member'),
  taskController.createSubtask,
);

router.get('/:taskId/comments', taskController.listComments);
router.post(
  '/:taskId/comments',
  authorize('owner', 'project_manager', 'team_member'),
  validate(createCommentSchema),
  taskController.createComment,
);
router.put(
  '/:taskId/comments/:commentId',
  authorize('owner', 'project_manager', 'team_member'),
  validate(updateCommentSchema),
  taskController.updateComment,
);
router.delete(
  '/:taskId/comments/:commentId',
  authorize('owner', 'project_manager', 'team_member'),
  taskController.deleteComment,
);

router.post(
  '/:taskId/attachments',
  authorize('owner', 'project_manager', 'team_member'),
  upload.single('file'),
  taskController.uploadAttachment,
);

router.post(
  '/:taskId/watchers',
  authorize('owner', 'project_manager', 'team_member'),
  taskController.addWatcher,
);
router.delete(
  '/:taskId/watchers',
  authorize('owner', 'project_manager', 'team_member'),
  taskController.removeWatcher,
);

export default router;
