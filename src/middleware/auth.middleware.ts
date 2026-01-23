// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { sendError } from '../utils/response.utils';
import { isTokenBlacklisted } from '../services/token.service';

// Define JWT payload interface
interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
}

// Extend Express Request interface
interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
    token?: string;
}

// Authentication middleware
export const authenticate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            sendError(res, 401, 'Access token is required');
            return;
        }

        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted
        const isBlacklisted = await isTokenBlacklisted(token);
        if (isBlacklisted) {
            sendError(res, 401, 'Token has been revoked');
            return;
        }

        // Verify token
        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

            if (decoded.type !== 'access') {
                sendError(res, 401, 'Invalid token type');
                return;
            }

            // Attach user info and token to request
            (req as AuthenticatedRequest).user = {
                userId: decoded.userId,
                email: decoded.email,
                role: decoded.role,
                type: decoded.type,
            };
            (req as AuthenticatedRequest).token = token;

            next();
        } catch (jwtError: any) {
            if (jwtError.name === 'TokenExpiredError') {
                sendError(res, 401, 'Token has expired');
            } else if (jwtError.name === 'JsonWebTokenError') {
                sendError(res, 401, 'Invalid token');
            } else {
                sendError(res, 401, 'Authentication failed');
            }
        }
    } catch (error) {
        next(error);
    }
};

// Authorization middleware (check roles)
export const authorize = (...allowedRoles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            sendError(res, 401, 'Not authenticated');
            return;
        }

        if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
            sendError(res, 403, 'Not authorized to access this resource');
            return;
        }

        next();
    };
};

// Export the type for use in other files
export type { AuthenticatedRequest, JwtPayload };