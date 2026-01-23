import { getRedis } from '../config/redis';
import { getTokenExpiry } from '../utils/jwt.util';

const REFRESH_TOKEN_PREFIX = 'refresh_token:';
const BLACKLIST_PREFIX = 'blacklist:';

// Store refresh token in Redis
export const storeRefreshToken = async (
    userId: string,
    token: string,
    expiresInSeconds: number = 7 * 24 * 60 * 60 // 7 days default
): Promise<void> => {
    const redis = getRedis();
    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
    await redis.setex(key, expiresInSeconds, token);
};

// Get stored refresh token
export const getStoredRefreshToken = async (userId: string): Promise<string | null> => {
    const redis = getRedis();
    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
    return redis.get(key);
};

// Delete refresh token (on logout)
export const deleteRefreshToken = async (userId: string): Promise<void> => {
    const redis = getRedis();
    const key = `${REFRESH_TOKEN_PREFIX}${userId}`;
    await redis.del(key);
};

// Blacklist an access token (on logout)
export const blacklistToken = async (token: string): Promise<void> => {
    const redis = getRedis();
    const expiry = getTokenExpiry(token);
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiry - now;

    if (ttl > 0) {
        const key = `${BLACKLIST_PREFIX}${token}`;
        await redis.setex(key, ttl, '1');
    }
};

// Check if token is blacklisted
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
    const redis = getRedis();
    const key = `${BLACKLIST_PREFIX}${token}`;
    const result = await redis.exists(key);
    return result === 1;
};