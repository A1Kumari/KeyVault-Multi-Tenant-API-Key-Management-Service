import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';
import {
    registerSchema,
    loginSchema,
    refreshTokenSchema,
    changePasswordSchema,
} from '../validation/auth.validation';

const router = Router();

// Public routes
router.post(
    '/register',
    authRateLimiter,
    validate(registerSchema),
    authController.register
);

router.post(
    '/login',
    authRateLimiter,
    validate(loginSchema),
    authController.login
);

router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authController.refresh
);

// Protected routes
router.post(
    '/logout',
    authenticate,
    authController.logout
);

router.get(
    '/me',
    authenticate,
    authController.getProfile
);

router.put(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword
);

export default router;