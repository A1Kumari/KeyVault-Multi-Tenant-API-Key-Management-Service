import { z } from "zod";

const emailField = z
    .string()
    .min(1, "Email is required")
    .email("Invalid email format")
    .toLowerCase()
    .trim();

const passwordField = z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters")
    .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    );

export const registerSchema = z.object({
    body: z.object({
        email: emailField,
        password: passwordField,
        name: z.string().min(2).max(100).optional(),
        companyName: z.string().min(2).max(100).optional()
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: emailField,
        password: z.string().min(1, "Password is required")
    })
});

export const changePasswordSchema = z.object({
    body: z
        .object({
            currentPassword: z.string().min(1, "Current password is required"),
            newPassword: passwordField
        })
        .refine(
            data => data.currentPassword !== data.newPassword,
            {
                message: "New password must be different from current password",
                path: ["newPassword"]
            }
        )
});

export const refreshTokenSchema = z.object({
    body: z.object({
        refreshToken: z.string().min(1, "Refresh token is required")
    })
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: emailField
    })
});

export const resetPasswordSchema = z.object({
    body: z.object({
        token: z.string().min(1, "Reset token is required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters")
    })
});
