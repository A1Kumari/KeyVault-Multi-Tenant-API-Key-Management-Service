import Redis from 'ioredis';
import { env } from './env';
import logger from './logger';

let redis: Redis | null = null;

export function getRedis(): Redis {
    if (!redis) {
        const redisUrl = env.UPSTASH_REDIS_URL || env.REDIS_URL;

        if (!redisUrl) {
            logger.warn('Redis URL not configured, using in-memory fallback');
            // Return a mock Redis for development without Redis
            return createMockRedis();
        }

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });

        redis.on('connect', () => {
            logger.info('✅ Redis connected');
        });

        redis.on('error', (err) => {
            logger.error('Redis error', { error: err.message });
        });
    }

    return redis;
}

// Simple in-memory cache for development without Redis
function createMockRedis(): Redis {
    const cache = new Map<string, { value: string; expiry?: number }>();

    return {
        get: async (key: string) => {
            const item = cache.get(key);
            if (!item) return null;
            if (item.expiry && Date.now() > item.expiry) {
                cache.delete(key);
                return null;
            }
            return item.value;
        },
        set: async (key: string, value: string, mode?: string, duration?: number) => {
            const expiry = duration ? Date.now() + (duration * 1000) : undefined;
            cache.set(key, { value, expiry });
            return 'OK';
        },
        incr: async (key: string) => {
            const item = cache.get(key);
            const newValue = item ? parseInt(item.value) + 1 : 1;
            cache.set(key, { value: String(newValue), expiry: item?.expiry });
            return newValue;
        },
        expire: async (key: string, seconds: number) => {
            const item = cache.get(key);
            if (item) {
                item.expiry = Date.now() + (seconds * 1000);
                return 1;
            }
            return 0;
        },
        ttl: async (key: string) => {
            const item = cache.get(key);
            if (!item || !item.expiry) return -1;
            return Math.ceil((item.expiry - Date.now()) / 1000);
        },
        del: async (key: string) => {
            return cache.delete(key) ? 1 : 0;
        }
    } as unknown as Redis;
}

export default getRedis;