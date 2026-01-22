// src/config/logger.ts

import winston from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;

    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }

    if (stack) {
        log += `\n${stack}`;
    }

    return log;
});

// Custom format for production (JSON)
const prodFormat = printf(({ level, message, timestamp, ...meta }) => {
    return JSON.stringify({
        timestamp,
        level,
        message,
        ...meta
    });
});

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
    ),
    defaultMeta: { service: 'keyvault-api' },
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                env.NODE_ENV === 'development' ? devFormat : prodFormat
            )
        })
    ]
});

// Add file transport in production
if (env.NODE_ENV === 'production') {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log'
    }));
}

export default logger;