// src/utils/errors.ts

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;
    public readonly details?: Record<string, any>;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = 'INTERNAL_ERROR',
        details?: Record<string, any>
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        this.details = details;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class BadRequestError extends AppError {
    constructor(message: string = 'Bad request', details?: Record<string, any>) {
        super(message, 400, 'BAD_REQUEST', details);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(message, 401, 'UNAUTHORIZED');
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(message, 403, 'FORBIDDEN');
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

export class TooManyRequestsError extends AppError {
    public readonly retryAfter: number;

    constructor(retryAfter: number = 60) {
        super('Too many requests', 429, 'RATE_LIMITED');
        this.retryAfter = retryAfter;
    }
}

export class ValidationError extends AppError {
    constructor(errors: Record<string, string[]>) {
        super('Validation failed', 400, 'VALIDATION_ERROR', { errors });
    }
}