import { Request, Response } from 'express';
import { auditService } from '../services/audit.service';

class AuditController {

    async list(req: any, res: Response) {
        try {
            const {
                page,
                limit,
                action,
                resourceType,
                resourceId,
                startDate,
                endDate,
                userId
            } = req.query;

            const logs = await auditService.getLogsForTenant(req.user.tenantId || req.user.userId, {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 50,
                action,
                resourceType,
                resourceId,
                startDate,
                endDate,
                userId
            });

            res.json({ success: true, data: logs });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async getSummary(req: any, res: Response) {
        // TODO: Implement summary logic (counts, etc)
        // For now returning mock or empty
        res.json({ success: true, data: { count: 0 } });
    }

    async getActions(req: any, res: Response) {
        // TODO: Return list of possible actions
        const actions = ['USER_LOGIN', 'KEY_CREATED', 'KEY_REVOKED', 'KEY_ROTATED'];
        res.json({ success: true, data: actions });
    }

    async getKeyLogs(req: any, res: Response) {
        try {
            const { keyId } = req.params;
            const logs = await auditService.getLogsForResource(
                req.user.tenantId || req.user.userId,
                'API_KEY',
                keyId
            );
            res.json({ success: true, data: logs });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}

export const auditController = new AuditController();
