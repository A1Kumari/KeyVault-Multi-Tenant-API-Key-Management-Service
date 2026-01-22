// src/middleware/errorHandler.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../config';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';

export function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): Response {
    // Log the error
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        requestId: req.requestId
    });

    // Handle Zod validation errors
    if (err instanceof ZodError) {
        const errors = err.errors.reduce((acc, e) => {
            const path = e.path.join('.');
            if (!acc[path]) acc[path] = [];
            acc[path].push(e.message);
            return acc;
        }, {} as Record<string, string[]>);

        return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', { errors });
    }

    // Handle our custom AppError
    if (err instanceof AppError) {
        return sendError(res, err.message, err.statusCode, err.code, err.details);
    }

    // Handle Prisma errors
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaError = err as any;

        if (prismaError.code === 'P2002') {
            return sendError(res, 'Resource already exists', 409, 'DUPLICATE_ENTRY');
        }

        if (prismaError.code === 'P2025') {
            return sendError(res, 'Resource not found', 404, 'NOT_FOUND');
        }
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return sendError(res, 'Invalid token', 401, 'INVALID_TOKEN');
    }

    if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Token expired', 401, 'TOKEN_EXPIRED');
    }

    // Default to 500 internal server error
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    return sendError(res, message, 500, 'INTERNAL_ERROR');
}

// Not found handler
export function notFoundHandler(req: Request, res: Response): Response {
    return sendError(
        res,
        `Route ${req.method} ${req.path} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
}