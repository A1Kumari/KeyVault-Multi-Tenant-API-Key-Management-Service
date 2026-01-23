import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { sendError } from '../utils/response.utils';

const RATE_LIMIT_PREFIX = 'rate_limit:';

export const rateLimiter = (
    windowMs: number = env.RATE_LIMIT_WINDOW_MS,
    maxRequests: number = env.RATE_LIMIT_MAX
) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const redis = getRedis();
            const key = `${RATE_LIMIT_PREFIX}${req.ip}`;

            const current = await redis.incr(key);

            if (current === 1) {
                await redis.expire(key, Math.ceil(windowMs / 1000));
            }

            // Set rate limit headers
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - current));

            if (current > maxRequests) {
                sendError(res, 429, 'Too many requests, please try again later');
                return;
            }

            next();
        } catch (error) {
            // If Redis fails, allow the request
            next();
        }
    };
};

// Stricter rate limiter for auth routes
export const authRateLimiter = rateLimiter(15 * 60 * 1000, 5); // 5 attempts per 15 minutes