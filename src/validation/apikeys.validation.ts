// src/validations/apiKeys.validation.ts

import { z } from 'zod';

const validScopes = ['read', 'write', 'delete', 'admin'] as const;

export const createApiKeySchema = {
    body: z.object({
        name: z
            .string({ required_error: 'Name is required' })
            .min(1, 'Name is required')
            .max(100, 'Name must be less than 100 characters')
            .trim(),
        scopes: z
            .array(z.enum(validScopes))
            .default(['read']),
        rateLimit: z
            .number()
            .int()
            .min(1, 'Rate limit must be at least 1')
            .max(10000, 'Rate limit cannot exceed 10000')
            .default(1000),
        expiresAt: z
            .string()
            .datetime()
            .optional()
            .refine(
                val => !val || new Date(val) > new Date(),
                'Expiration date must be in the future'
            ),
        ipWhitelist: z
            .array(z.string().ip())
            .max(20, 'Cannot have more than 20 IP addresses')
            .optional()
    })
};

export const updateApiKeySchema = {
    body: z.object({
        name: z
            .string()
            .min(1)
            .max(100)
            .trim()
            .optional(),
        scopes: z
            .array(z.enum(validScopes))
            .optional(),
        rateLimit: z
            .number()
            .int()
            .min(1)
            .max(10000)
            .optional(),
        expiresAt: z
            .string()
            .datetime()
            .nullable()
            .optional(),
        ipWhitelist: z
            .array(z.string().ip())
            .max(20)
            .optional(),
        isActive: z.boolean().optional()
    }),
    params: z.object({
        id: z.string().cuid()
    })
};

export const getApiKeySchema = {
    params: z.object({
        id: z.string().cuid()
    })
};

export const verifyApiKeySchema = {
    body: z.object({
        key: z.string({ required_error: 'API key is required' })
    })
};

export const listApiKeysSchema = {
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).default('1'),
        limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
        isActive: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
        search: z.string().optional()
    })
};