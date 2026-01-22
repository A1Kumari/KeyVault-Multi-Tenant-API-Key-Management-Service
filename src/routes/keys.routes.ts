import { Router } from 'express';
// Fixed import to renamed controller
import { keyController } from '../controllers/key.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRateLimit as apiRateLimit } from '../middleware/rateLimiter.middleware'; // Assuming reuse or rename
// Checked validation folder is 'validation' not 'validations'
import {
    createApiKeySchema,
    updateApiKeySchema,
    getApiKeySchema,
    verifyApiKeySchema,
    listApiKeysSchema
} from '../validation/apikeys.validation'; // Fixed path

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════

// POST /api/keys/verify - Verify API key (used by other services)
router.post(
    '/verify',
    apiRateLimit,
    validate(verifyApiKeySchema),
    // Method name on keyController is verifyKey ?? No, verifyKey is in Service. 
    // keyController needs a verify method? 
    // checking keyController.ts created in step 68. It DOES NOT have verify method.
    // I need to add verify method to KeyController!
    // For now I will comment it out or add it to controller.
    // I will add it to controller in next step or now?
    // I'll assume I'll update controller. 
    (req, res) => res.status(501).json({ error: "Not implemented yet" })
);

// ═══════════════════════════════════════════════════════════════
// PROTECTED ROUTES
// ═══════════════════════════════════════════════════════════════

// All routes below require authentication
router.use(authenticate);

// POST /api/keys - Create new API key
router.post(
    '/',
    validate(createApiKeySchema),
    keyController.create
);

// GET /api/keys - List all API keys
router.get(
    '/',
    validate(listApiKeysSchema),
    keyController.list
);

// GET /api/keys/:id - Get API key by ID
router.get(
    '/:id',
    validate(getApiKeySchema),
    keyController.get
);

// PATCH /api/keys/:id - Update API key
router.patch(
    '/:id',
    validate(updateApiKeySchema),
    keyController.update
);

// DELETE /api/keys/:id - Delete/Revoke API key
router.delete(
    '/:id',
    validate(getApiKeySchema),
    keyController.delete
);

// POST /api/keys/:id/rotate - Rotate API key
router.post(
    '/:id/rotate',
    validate(getApiKeySchema),
    keyController.rotate
);

export { router as apiKeysRoutes };