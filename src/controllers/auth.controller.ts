// src/controllers/auth.controller.ts
import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response.utils';

// Define the extended request interface locally
interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
}

interface AuthenticatedRequest extends Request {
    user?: JwtPayload;
    token?: string;
}

// Register
export const register = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email, password, name } = req.body;

        const result = await authService.register({ email, password, name });

        sendSuccess(res, 201, 'Registration successful', {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
    } catch (error: any) {
        if (error.message === 'Email already registered') {
            sendError(res, 409, error.message);
        } else {
            next(error);
        }
    }
};

// Login
export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email, password } = req.body;

        const result = await authService.login({ email, password });

        sendSuccess(res, 200, 'Login successful', {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        });
    } catch (error: any) {
        if (error.message === 'Invalid email or password' || error.message === 'Account is deactivated') {
            sendError(res, 401, error.message);
        } else {
            next(error);
        }
    }
};

// Refresh token
export const refresh = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        const tokens = await authService.refreshTokens(refreshToken);

        sendSuccess(res, 200, 'Token refreshed successfully', tokens);
    } catch (error: any) {
        sendError(res, 401, 'Invalid refresh token');
    }
};

// Logout - Use AuthenticatedRequest here
export const logout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user || !req.token) {
            sendError(res, 401, 'Not authenticated');
            return;
        }

        await authService.logout(req.user.userId, req.token);

        sendSuccess(res, 200, 'Logged out successfully');
    } catch (error) {
        next(error);
    }
};

// Get current user profile - Use AuthenticatedRequest here
export const getProfile = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 401, 'Not authenticated');
            return;
        }

        const user = await authService.getProfile(req.user.userId);

        sendSuccess(res, 200, 'Profile retrieved successfully', { user });
    } catch (error) {
        next(error);
    }
};

// Change password - Use AuthenticatedRequest here
export const changePassword = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            sendError(res, 401, 'Not authenticated');
            return;
        }

        const { currentPassword, newPassword } = req.body;

        await authService.changePassword(req.user.userId, currentPassword, newPassword);

        sendSuccess(res, 200, 'Password changed successfully');
    } catch (error: any) {
        if (error.message === 'Current password is incorrect') {
            sendError(res, 400, error.message);
        } else {
            next(error);
        }
    }
};