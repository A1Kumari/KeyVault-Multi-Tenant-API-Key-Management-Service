const { redisClient } = require('../config/redis');

class RateLimiter {
    /**
     * Check if request is within rate limit
     * Uses sliding window algorithm with Redis sorted sets
     * 
     * @param {string} keyId - The API key ID
     * @param {number} limit - Max requests per window
     * @param {number} windowMs - Window size in milliseconds (default: 60000 = 1 minute)
     * @returns {Object} { allowed, remaining, reset, retryAfter }
     */
    async checkLimit(keyId, limit, windowMs = 60000) {
        // No limit configured = allow all
        if (!limit || limit === 0) {
            return {
                allowed: true,
                remaining: Infinity,
                reset: 0
            };
        }

        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `ratelimit:${keyId}`;

        try {
            // Use Redis transaction for atomic operations
            const multi = redisClient.multi();

            // 1. Remove requests older than the window
            multi.zRemRangeByScore(redisKey, 0, windowStart);

            // 2. Add current request with timestamp as score
            multi.zAdd(redisKey, {
                score: now,
                value: `${now}-${Math.random().toString(36).substring(7)}`
            });

            // 3. Count total requests in current window
            multi.zCard(redisKey);

            // 4. Set expiry on the key (cleanup)
            multi.expire(redisKey, Math.ceil(windowMs / 1000) + 10);

            // Execute all commands atomically
            const results = await multi.exec();

            // results[2] contains the count (index 2 = zCard result)
            const count = results[2];

            // Calculate reset time
            const resetTime = Math.ceil((now + windowMs) / 1000);

            // Check if over limit
            if (count > limit) {
                // Over limit - remove the request we just added
                await redisClient.zRemRangeByScore(redisKey, now, now);

                return {
                    allowed: false,
                    remaining: 0,
                    reset: resetTime,
                    retryAfter: Math.ceil(windowMs / 1000)
                };
            }

            return {
                allowed: true,
                remaining: Math.max(0, limit - count),
                reset: resetTime,
                retryAfter: null
            };

        } catch (error) {
            console.error('❌ Rate Limiter Error:', error.message);

            // Fail OPEN - allow request if Redis is down
            // This is a business decision: reliability over strict rate limiting
            // Change to { allowed: false } if you want fail CLOSED
            return {
                allowed: true,
                remaining: 0,
                reset: 0,
                error: 'Rate limiter unavailable'
            };
        }
    }

    /**
     * Get current usage for a key (without incrementing)
     * Useful for showing usage stats
     */
    async getUsage(keyId, limit, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `ratelimit:${keyId}`;

        try {
            // Remove old entries first
            await redisClient.zRemRangeByScore(redisKey, 0, windowStart);

            // Count current entries
            const count = await redisClient.zCard(redisKey);

            return {
                used: count,
                limit: limit,
                remaining: Math.max(0, limit - count),
                reset: Math.ceil((now + windowMs) / 1000)
            };
        } catch (error) {
            console.error('❌ Get Usage Error:', error.message);
            return {
                used: 0,
                limit: limit,
                remaining: limit,
                reset: 0,
                error: 'Could not get usage'
            };
        }
    }

    /**
     * Reset rate limit for a key
     * Useful for admin operations
     */
    async resetLimit(keyId) {
        const redisKey = `ratelimit:${keyId}`;

        try {
            await redisClient.del(redisKey);
            return { success: true, message: 'Rate limit reset' };
        } catch (error) {
            console.error('❌ Reset Limit Error:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new RateLimiter();