// src/validations/audit.validation.ts

import { z } from 'zod';

export const listAuditLogsSchema = {
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).default('1'),
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(
            z.number().min(1).max(100)
        ).default('50'),
        action: z.string().optional(),
        resourceType: z.string().optional(),
        resourceId: z.string().optional(),
        userId: z.string().optional(),
        status: z.enum(['success', 'failure']).optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
    })
};

export const getKeyLogsSchema = {
    params: z.object({
        keyId: z.string().cuid()
    }),
    query: z.object({
        limit: z.string().regex(/^\d+$/).transform(Number).pipe(
            z.number().min(1).max(100)
        ).default('50')
    })
};

export const auditSummarySchema = {
    query: z.object({
        days: z.string().regex(/^\d+$/).transform(Number).pipe(
            z.number().min(1).max(90)
        ).default('30')
    })
};