// src/modules/secrets/secrets.routes.ts

import { Router } from 'express';
import { secretsController } from './secrets.controller';
import { authenticate } from '@/shared/middleware/auth.middleware';
import { orgContext, requirePermission } from '@/shared/middleware/rbac.middleware';
import { validate } from '@/shared/middleware/validation.middleware';
import { createSecretSchema, updateSecretSchema, listSecretsSchema } from './secrets.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Project-scoped secret routes
router.use('/projects/:projectId/env/:env/secrets', orgContext());

router.post(
    '/projects/:projectId/env/:env/secrets',
    requirePermission('secret:write'),
    validate(createSecretSchema),
    secretsController.createSecret
);

router.get(
    '/projects/:projectId/env/:env/secrets',
    requirePermission('secret:read'),
    validate(listSecretsSchema),
    secretsController.listSecrets
);

router.get(
    '/projects/:projectId/env/:env/secrets/:key',
    requirePermission('secret:read'),
    secretsController.getSecret
);

router.patch(
    '/projects/:projectId/env/:env/secrets/:key',
    requirePermission('secret:write'),
    validate(updateSecretSchema),
    secretsController.updateSecret
);

router.delete(
    '/projects/:projectId/env/:env/secrets/:key',
    requirePermission('secret:delete'),
    secretsController.deleteSecret
);

// Bulk operations
router.post(
    '/projects/:projectId/env/:env/secrets/bulk',
    requirePermission('secret:write'),
    secretsController.bulkUpsert
);

router.post(
    '/projects/:projectId/env/:env/import',
    requirePermission('secret:write'),
    secretsController.importSecrets
);

router.get(
    '/projects/:projectId/env/:env/export',
    requirePermission('secret:read'),
    secretsController.exportSecrets
);

// Version management
router.get(
    '/secrets/:secretId/versions',
    orgContext(),
    requirePermission('secret:read'),
    secretsController.getVersions
);

router.post(
    '/secrets/:secretId/rollback/:version',
    orgContext(),
    requirePermission('secret:write'),
    secretsController.rollback
);

export { router as secretsRoutes };