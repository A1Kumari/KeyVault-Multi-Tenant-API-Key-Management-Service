// src/middleware/auth.middleware.ts

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';
import { Tenant } from '../models'; // Import Sequelize model

// Mock env if not available or just use process.env
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function authenticate(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new UnauthorizedError('No token provided');
        }

        // Verify JWT
        const decoded = jwt.verify(token, JWT_SECRET) as any; // Using any to avoid strict JwtPayload mismatch for now

        // Check if tenant/user exists using Sequelize
        const user = await Tenant.findByPk(decoded.userId || decoded.id, {
            attributes: ['id', 'email'] // Tenant model seems to be User
        });

        if (!user) {
            throw new UnauthorizedError('User not found');
        }

        // Attach user to request
        req.user = {
            userId: user.id,
            email: user.email,
            tenantId: user.id // Assuming tenant mapping is direct for now
        };

        // logger.debug('User authenticated', { userId: user.id });

        next();
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            next(error);
        } else if (error instanceof jwt.JsonWebTokenError) {
            next(new UnauthorizedError('Invalid token'));
        } else if (error instanceof jwt.TokenExpiredError) {
            next(new UnauthorizedError('Token expired'));
        } else {
            next(error);
        }
    }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET) as any;

        req.user = {
            userId: decoded.userId || decoded.id,
            email: decoded.email,
            tenantId: decoded.tenantId || decoded.id
        };

        next();
    } catch {
        // Silently continue without auth
        next();
    }
}