// src/types/index.ts

import { Request } from 'express';

// User type from JWT payload
export interface JwtPayload {
    userId: string;
    email: string;
    tenantId: string;
    iat?: number;
    exp?: number;
}

// Extended Request with authenticated user
export interface AuthenticatedRequest extends Request {
    user: JwtPayload;
    requestId: string;
}

// API Key verification request
export interface ApiKeyRequest extends Request {
    apiKey?: {
        id: string;
        tenantId: string;
        name: string;
        scopes: string[];
        rateLimit: number;
    };
    requestId: string;
}

// Pagination query params
export interface PaginationQuery {
    page?: string;
    limit?: string;
}

// Common filter options
export interface BaseFilters {
    startDate?: string;
    endDate?: string;
    search?: string;
}

// Audit log filters
export interface AuditLogFilters extends PaginationQuery, BaseFilters {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    userId?: string;
    status?: string;
}

// API Key create/update types
export interface CreateApiKeyInput {
    name: string;
    scopes?: string[];
    rateLimit?: number;
    expiresAt?: string;
    ipWhitelist?: string[];
}

export interface UpdateApiKeyInput {
    name?: string;
    scopes?: string[];
    rateLimit?: number;
    expiresAt?: string;
    ipWhitelist?: string[];
    isActive?: boolean;
}