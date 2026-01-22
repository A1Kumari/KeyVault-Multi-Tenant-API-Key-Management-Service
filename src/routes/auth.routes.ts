// src/routes/auth.routes.ts

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRateLimit } from '../middleware/rateLimiter.middleware';
import {
    registerSchema,
    loginSchema,
    changePasswordSchema,
    refreshTokenSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from '../validations/auth.validation';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/auth/register - Register new user
router.post(
    '/register',
    authRateLimit,
    validate(registerSchema),
    authController.register
);

// POST /api/auth/login - User login
router.post(
    '/login',
    authRateLimit,
    validate(loginSchema),
    authController.login
);

// POST /api/auth/refresh - Refresh JWT token
router.post(
    '/refresh',
    validate(refreshTokenSchema),
    authController.refreshToken
);

// POST /api/auth/forgot-password - Request password reset
router.post(
    '/forgot-password',
    authRateLimit,
    validate(forgotPasswordSchema),
    authController.forgotPassword
);

// POST /api/auth/reset-password - Reset password with token
router.post(
    '/reset-password',
    authRateLimit,
    validate(resetPasswordSchema),
    authController.resetPassword
);

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════════

// GET /api/auth/me - Get current user profile
router.get(
    '/me',
    authenticate,
    authController.getMe
);

// POST /api/auth/logout - User logout
router.post(
    '/logout',
    authenticate,
    authController.logout
);

// PUT /api/auth/password - Change password
router.put(
    '/password',
    authenticate,
    validate(changePasswordSchema),
    authController.changePassword
);

export { router as authRoutes };