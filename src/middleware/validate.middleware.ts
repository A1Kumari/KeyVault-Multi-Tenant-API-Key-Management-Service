// src/middleware/validate.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/response';

interface ValidationSchemas {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

export function validate(schemas: ValidationSchemas) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }

            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query);
            }

            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                const errors = error.errors.reduce((acc, err) => {
                    const path = err.path.join('.');
                    if (!acc[path]) acc[path] = [];
                    acc[path].push(err.message);
                    return acc;
                }, {} as Record<string, string[]>);

                return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', { errors });
            }
            next(error);
        }
    };
}