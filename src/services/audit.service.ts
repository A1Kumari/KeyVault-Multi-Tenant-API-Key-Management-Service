import { AuditLog } from '../models';
import { Op } from 'sequelize';

class AuditService {

    /**
     * Create an audit log entry
     */
    async log(params: any) {
        const {
            tenantId,
            userId = null,
            action,
            resourceType,
            resourceId = null,
            description = null,
            metadata = {},
            ipAddress = null,
            userAgent = null,
            requestId = null,
            status = 'SUCCESS',
            errorMessage = null
        } = params;
        try {
            const auditLog = await AuditLog.create({
                tenantId,
                userId,
                action,
                resourceType,
                resourceId,
                description,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString()
                },
                ipAddress,
                userAgent,
                requestId,
                status,
                errorMessage
            });
            return auditLog;
        } catch (error: any) {
            console.error(`❌ [AUDIT] Failed to create audit log: ${error.message}`);
            return null;
        }
    }

    /**
     * Log asynchronously (fire and forget)
     */
    logAsync(params: any) {
        this.log(params).catch(err => {
            console.error(`❌ [AUDIT ASYNC] Failed: ${err.message}`);
        });
    }

    async logUserRegistration(req: any, userId: string, tenantId: string) {
        return this.log({
            tenantId,
            userId,
            action: 'USER_REGISTERED',
            resourceType: 'USER',
            resourceId: userId,
            description: 'New user registered',
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            requestId: req.requestId || (req as any).id
        });
    }

    async logUserLogin(req: any, userId: string, tenantId: string, success = true) {
        return this.log({
            tenantId,
            userId,
            action: success ? 'USER_LOGIN' : 'USER_LOGIN_FAILED',
            resourceType: 'USER',
            resourceId: userId,
            description: success ? 'User logged in successfully' : 'Login attempt failed',
            status: success ? 'SUCCESS' : 'FAILURE',
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            requestId: req.requestId || (req as any).id,
            metadata: {
                email: req.body?.email
            }
        });
    }

    async getLogsForTenant(tenantId: string, options: any = {}) {
        const {
            page = 1,
            limit = 50,
            action = null,
            resourceType = null,
            resourceId = null,
            startDate = null,
            endDate = null,
            userId = null
        } = options;

        const where: any = { tenantId };

        if (action) where.action = action;
        if (resourceType) where.resourceType = resourceType;
        if (resourceId) where.resourceId = resourceId;
        if (userId) where.userId = userId;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const { count, rows } = await AuditLog.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });

        return {
            logs: rows,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    async getLogsForResource(tenantId: string, resourceType: string, resourceId: string, limit = 50) {
        return AuditLog.findAll({
            where: { tenantId, resourceType, resourceId },
            order: [['createdAt', 'DESC']],
            limit
        });
    }

    getClientIP(req: any) {
        return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.headers['x-real-ip'] ||
            req.connection?.remoteAddress ||
            req.ip ||
            'unknown';
    }
}

export const auditService = new AuditService();
