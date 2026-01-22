// src/shared/middleware/rbac.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/database';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';

export type Permission =
    | 'org:read' | 'org:write' | 'org:delete' | 'org:admin'
    | 'project:read' | 'project:write' | 'project:delete'
    | 'secret:read' | 'secret:write' | 'secret:delete'
    | 'member:read' | 'member:write' | 'member:delete'
    | 'apikey:read' | 'apikey:write' | 'apikey:delete'
    | 'audit:read';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
    OWNER: [
        'org:read', 'org:write', 'org:delete', 'org:admin',
        'project:read', 'project:write', 'project:delete',
        'secret:read', 'secret:write', 'secret:delete',
        'member:read', 'member:write', 'member:delete',
        'apikey:read', 'apikey:write', 'apikey:delete',
        'audit:read'
    ],
    ADMIN: [
        'org:read', 'org:write',
        'project:read', 'project:write', 'project:delete',
        'secret:read', 'secret:write', 'secret:delete',
        'member:read', 'member:write',
        'apikey:read', 'apikey:write', 'apikey:delete',
        'audit:read'
    ],
    MEMBER: [
        'org:read',
        'project:read',
        'secret:read', 'secret:write',
        'member:read',
        'apikey:read'
    ],
    VIEWER: [
        'org:read',
        'project:read',
        'secret:read',
        'member:read'
    ]
};

export interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        orgId?: string;
        orgRole?: string;
        permissions?: Permission[];
    };
    apiKey?: {
        id: string;
        permissions: string[];
        organizationId: string;
    };
}

/**
 * Load organization context from URL params
 */
export function orgContext() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            const orgId = req.params.orgId || req.headers['x-organization-id'] as string;

            if (!orgId) {
                return next();
            }

            if (req.apiKey) {
                // API key already has org context
                if (req.apiKey.organizationId !== orgId) {
                    throw new ForbiddenError('API key does not have access to this organization');
                }
                req.user = {
                    id: req.apiKey.id,
                    email: 'api-key',
                    orgId: req.apiKey.organizationId,
                    permissions: req.apiKey.permissions as Permission[]
                };
                return next();
            }

            if (!req.user?.id) {
                throw new UnauthorizedError('Authentication required');
            }

            // Get user's membership in this org
            const membership = await prisma.orgMember.findUnique({
                where: {
                    userId_organizationId: {
                        userId: req.user.id,
                        organizationId: orgId
                    }
                }
            });

            if (!membership) {
                throw new ForbiddenError('You are not a member of this organization');
            }

            req.user.orgId = orgId;
            req.user.orgRole = membership.role;
            req.user.permissions = ROLE_PERMISSIONS[membership.role] || [];

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Require specific permissions
 */
export function requirePermission(...requiredPermissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user?.permissions) {
                throw new ForbiddenError('No permissions found');
            }

            const hasPermission = requiredPermissions.every(
                perm => req.user!.permissions!.includes(perm)
            );

            if (!hasPermission) {
                throw new ForbiddenError(
                    `Missing required permissions: ${requiredPermissions.join(', ')}`
                );
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Require any of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        try {
            if (!req.user?.permissions) {
                throw new ForbiddenError('No permissions found');
            }

            const hasAnyPermission = permissions.some(
                perm => req.user!.permissions!.includes(perm)
            );

            if (!hasAnyPermission) {
                throw new ForbiddenError('Insufficient permissions');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}