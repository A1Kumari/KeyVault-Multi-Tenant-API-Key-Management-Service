// src/middleware/rateLimiter.middleware.ts

import { Request, Response, NextFunction } from 'express';
import { getRedis, logger } from '../config';
import { TooManyRequestsError } from '../utils/errors';

interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    max: number;           // Max requests per window
    keyPrefix?: string;    // Redis key prefix
    keyGenerator?: (req: Request) => string;  // Custom key generator
}

interface RateLimitInfo {
    allowed: boolean;
    remaining: number;
    reset: number;
    retryAfter?: number;
}

export class RateLimiter {
    private redis = getRedis();

    /**
     * Check rate limit for a given key
     */
    async checkLimit(key: string, limit: number, windowSeconds: number = 60): Promise<RateLimitInfo> {
        const now = Date.now();
        const windowStart = now - (windowSeconds * 1000);
        const redisKey = `ratelimit:${key}`;

        try {
            // Get current count
            const countStr = await this.redis.get(redisKey);
            const count = countStr ? parseInt(countStr, 10) : 0;

            if (count >= limit) {
                const ttl = await this.redis.ttl(redisKey);
                return {
                    allowed: false,
                    remaining: 0,
                    reset: Math.ceil(now / 1000) + ttl,
                    retryAfter: ttl > 0 ? ttl : windowSeconds
                };
            }

            // Increment count
            const newCount = await this.redis.incr(redisKey);

            // Set expiry if this is the first request in the window
            if (newCount === 1) {
                await this.redis.expire(redisKey, windowSeconds);
            }

            const ttl = await this.redis.ttl(redisKey);

            return {
                allowed: true,
                remaining: Math.max(0, limit - newCount),
                reset: Math.ceil(now / 1000) + ttl
            };
        } catch (error) {
            logger.error('Rate limiter error', { error, key });
            // Fail open - allow request if Redis is down
            return {
                allowed: true,
                remaining: limit,
                reset: Math.ceil(now / 1000) + windowSeconds
            };
        }
    }

    /**
     * Create Express middleware
     */
    middleware(config: RateLimitConfig) {
        const {
            windowMs,
            max,
            keyPrefix = 'ip',
            keyGenerator = (req) => req.ip || 'unknown'
        } = config;

        const windowSeconds = Math.ceil(windowMs / 1000);

        return async (req: Request, res: Response, next: NextFunction) => {
            const key = `${keyPrefix}:${keyGenerator(req)}`;

            const result = await this.checkLimit(key, max, windowSeconds);

            // Set rate limit headers
            res.set({
                'X-RateLimit-Limit': String(max),
                'X-RateLimit-Remaining': String(result.remaining),
                'X-RateLimit-Reset': String(result.reset)
            });

            if (!result.allowed) {
                res.set('Retry-After', String(result.retryAfter));
                throw new TooManyRequestsError(result.retryAfter);
            }

            next();
        };
    }
}

export const rateLimiter = new RateLimiter();

// Pre-configured middleware for common use cases
export const apiRateLimit = rateLimiter.middleware({
    windowMs: 60 * 1000,  // 1 minute
    max: 100,             // 100 requests per minute
    keyPrefix: 'api'
});

export const authRateLimit = rateLimiter.middleware({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                    // 10 attempts
    keyPrefix: 'auth'
});