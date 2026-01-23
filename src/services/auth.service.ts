// src/services/auth.service.ts
import User from '../models/user.model';  // ← Default import (no curly braces)
import { generateTokens, verifyRefreshToken } from '../utils/jwt.util';
import * as tokenService from './token.service';

interface RegisterInput {
    email: string;
    password: string;
    name?: string;
}

interface LoginInput {
    email: string;
    password: string;
}

interface AuthResult {
    user: any;
    accessToken: string;
    refreshToken: string;
}

// Register a new user
export const register = async (input: RegisterInput): Promise<AuthResult> => {
    const { email, password, name } = input;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
        throw new Error('Email already registered');
    }

    // Create user (password is hashed in model hook)
    const user = await User.create({ email, password, name });

    // Generate tokens
    const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    // Store refresh token in Redis
    await tokenService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
        user: user.toJSON(),
        ...tokens,
    };
};

// Login user
export const login = async (input: LoginInput): Promise<AuthResult> => {
    const { email, password } = input;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
        throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
        throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    // Update last login
    await user.update({ lastLoginAt: new Date() });

    // Generate tokens
    const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    // Store refresh token in Redis
    await tokenService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
        user: user.toJSON(),
        ...tokens,
    };
};

// Refresh tokens
export const refreshTokens = async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> => {
    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
    }

    // Check if refresh token matches stored one
    const storedToken = await tokenService.getStoredRefreshToken(payload.userId);
    if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
    }

    // Get user
    const user = await User.findByPk(payload.userId);
    if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
    }

    // Generate new tokens (token rotation)
    const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    // Store new refresh token
    await tokenService.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
};

// Logout user
export const logout = async (userId: string, accessToken: string): Promise<void> => {
    // Blacklist the access token
    await tokenService.blacklistToken(accessToken);

    // Delete refresh token
    await tokenService.deleteRefreshToken(userId);
};

// Get user profile
export const getProfile = async (userId: string): Promise<any> => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error('User not found');
    }
    return user.toJSON();
};

// Change password
export const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
): Promise<void> => {
    const user = await User.findByPk(userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
    }

    // Update password (will be hashed by model hook)
    await user.update({ password: newPassword });

    // Invalidate all refresh tokens for this user
    await tokenService.deleteRefreshToken(userId);
};