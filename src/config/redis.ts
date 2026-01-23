import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

export const getRedis = (): Redis => {
    if (!redis) {
        const redisUrl = env.UPSTASH_REDIS_URL || env.REDIS_URL;

        if (!redisUrl) {
            console.warn('⚠️ Redis URL not configured, using mock');
            return createMockRedis();
        }

        redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) return null;
                return Math.min(times * 100, 3000);
            }
        });

        redis.on('connect', () => console.log('✅ Redis connected'));
        redis.on('error', (err) => console.error('❌ Redis error:', err.message));
    }

    return redis;
};

export const closeRedis = async (): Promise<void> => {
    if (redis) {
        await redis.quit();
        redis = null;
    }
};

// Mock Redis for development without Redis
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
            const expiry = duration ? Date.now() + duration * 1000 : undefined;
            cache.set(key, { value, expiry });
            return 'OK';
        },
        setex: async (key: string, seconds: number, value: string) => {
            cache.set(key, { value, expiry: Date.now() + seconds * 1000 });
            return 'OK';
        },
        del: async (...keys: string[]) => {
            keys.forEach(key => cache.delete(key));
            return keys.length;
        },
        exists: async (...keys: string[]) => {
            return keys.filter(key => cache.has(key)).length;
        },
        quit: async () => {
            cache.clear();
            return 'OK';
        }
    } as unknown as Redis;
}

export default getRedis;