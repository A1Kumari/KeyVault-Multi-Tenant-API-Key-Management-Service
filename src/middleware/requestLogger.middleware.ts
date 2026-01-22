// src/middleware/requestLogger.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    // Generate unique request ID
    req.requestId = req.headers['x-request-id'] as string || uuidv4();
    req.startTime = Date.now();

    // Add request ID to response headers
    res.set('X-Request-ID', req.requestId);

    // Log request
    logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent')
    });

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - (req.startTime || 0);
        const level = res.statusCode >= 400 ? 'warn' : 'info';

        logger[level]('Request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`
        });
    });

    next();
}