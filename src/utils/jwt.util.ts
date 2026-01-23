import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
}

// Generate access token (short-lived)
export const generateAccessToken = (payload: Omit<TokenPayload, 'type'>): string => {
    return jwt.sign(
        { ...payload, type: 'access' },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
    );
};

// Generate refresh token (long-lived)
export const generateRefreshToken = (payload: Omit<TokenPayload, 'type'>): string => {
    return jwt.sign(
        { ...payload, type: 'refresh' },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions
    );
};

// Generate both tokens
export const generateTokens = (payload: Omit<TokenPayload, 'type'>) => {
    return {
        accessToken: generateAccessToken(payload),
        refreshToken: generateRefreshToken(payload),
    };
};

// Verify access token
export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};

// Verify refresh token
export const verifyRefreshToken = (token: string): TokenPayload => {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
};

// Get token expiry time in seconds
export const getTokenExpiry = (token: string): number => {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded?.exp || 0;
};