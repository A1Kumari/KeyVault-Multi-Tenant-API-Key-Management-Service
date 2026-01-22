// src/config/env.ts

import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000').transform(Number),

    // Database
    DATABASE_URL: z.string().url(),

    // Redis
    // Upstash Redis (TCP URL for ioredis) - takes priority if set
    UPSTASH_REDIS_URL: z.string().url().optional(),
    // Upstash Redis REST (HTTP)
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

    // Local/Self-hosted Redis
    REDIS_URL: z.string().url().optional(),

    // JWT
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('7d'),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

    // Encryption
    MASTER_KEY: z.string().length(64), // 256-bit hex key

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
    RATE_LIMIT_MAX: z.string().default('100').transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;