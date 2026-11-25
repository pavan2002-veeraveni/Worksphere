import { Router } from 'express';
import { authController } from '../../controllers/authController';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
} from '../../validators/auth.validators';

const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user account
 *     security: []
 *     responses:
 *       201: { description: User registered }
 *       409: { description: Email already exists }
 */
router.post('/register', validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Authenticate user and issue access + refresh tokens
 *     security: []
 *     responses:
 *       200: { description: Authenticated }
 *       401: { description: Invalid credentials }
 */
router.post('/login', validate(loginSchema), authController.login);

/**
 * @openapi
 * /auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and issue new access/refresh pair
 *     security: []
 *     responses:
 *       200: { description: Tokens rotated }
 *       401: { description: Invalid or reused refresh token }
 */
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Revoke refresh token(s)
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user profile and organization memberships
 *     responses:
 *       200: { description: Current profile }
 */
router.get('/me', authenticate, authController.me);

export default router;
