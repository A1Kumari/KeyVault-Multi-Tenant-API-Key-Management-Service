// src/utils/response.ts

import { Response } from 'express';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    code?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
    timestamp: string;
}

export interface PaginationParams {
    page: number;
    limit: number;
    total: number;
}

export function sendSuccess<T>(
    res: Response,
    data: T,
    statusCode: number = 200,
    message?: string
): Response {
    const response: ApiResponse<T> = {
        success: true,
        data,
        message,
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
}

export function sendPaginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationParams,
    statusCode: number = 200
): Response {
    const { page, limit, total } = pagination;
    const totalPages = Math.ceil(total / limit);

    const response: ApiResponse<T[]> = {
        success: true,
        data,
        meta: {
            page,
            limit,
            total,
            totalPages
        },
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
}

export function sendError(
    res: Response,
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
): Response {
    const response: ApiResponse = {
        success: false,
        error: message,
        code,
        ...details,
        timestamp: new Date().toISOString()
    };

    return res.status(statusCode).json(response);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
    return sendSuccess(res, data, 201, message);
}

export function sendNoContent(res: Response): Response {
    return res.status(204).send();
}