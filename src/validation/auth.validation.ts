// src/validations/auth.validation.ts

import { z } from 'zod';

export const registerSchema = {
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase()
            .trim(),
        password: z
            .string({ required_error: 'Password is required' })
            .min(8, 'Password must be at least 8 characters')
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            ),
        name: z.string().min(2).max(100).optional(),
        companyName: z.string().min(2).max(100).optional()
    })
};

export const loginSchema = {
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase()
            .trim(),
        password: z.string({ required_error: 'Password is required' })
    })
};

export const changePasswordSchema = {
    body: z.object({
        currentPassword: z.string({ required_error: 'Current password is required' }),
        newPassword: z
            .string({ required_error: 'New password is required' })
            .min(8, 'Password must be at least 8 characters')
            .regex(
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                'Password must contain at least one uppercase letter, one lowercase letter, and one number'
            )
    }).refine(
        data => data.currentPassword !== data.newPassword,
        { message: 'New password must be different from current password', path: ['newPassword'] }
    )
};

export const refreshTokenSchema = {
    body: z.object({
        refreshToken: z.string({ required_error: 'Refresh token is required' })
    })
};

export const forgotPasswordSchema = {
    body: z.object({
        email: z
            .string({ required_error: 'Email is required' })
            .email('Invalid email format')
            .toLowerCase()
            .trim()
    })
};

export const resetPasswordSchema = {
    body: z.object({
        token: z.string({ required_error: 'Reset token is required' }),
        newPassword: z
            .string({ required_error: 'New password is required' })
            .min(8, 'Password must be at least 8 characters')
    })
};