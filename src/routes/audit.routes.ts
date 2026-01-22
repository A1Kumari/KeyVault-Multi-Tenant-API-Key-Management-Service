import { Router } from 'express';
import { auditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
    listAuditLogsSchema,
    getKeyLogsSchema,
    auditSummarySchema
} from '../validation/audit.validation'; // Fixed path from validations to validation

const router = Router();

// All audit routes require authentication
router.use(authenticate);

// GET /api/audit - Get audit logs with filtering
router.get(
    '/',
    validate(listAuditLogsSchema),
    auditController.list
);

// GET /api/audit/summary - Get audit statistics
router.get(
    '/summary',
    validate(auditSummarySchema),
    auditController.getSummary
);

// GET /api/audit/actions - Get available actions list
router.get(
    '/actions',
    auditController.getActions
);

// GET /api/audit/keys/:keyId - Get logs for specific key
router.get(
    '/keys/:keyId',
    validate(getKeyLogsSchema),
    auditController.getKeyLogs
);

export { router as auditRoutes };