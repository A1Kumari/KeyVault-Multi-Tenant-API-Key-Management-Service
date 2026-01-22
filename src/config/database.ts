const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'postgres',
        port: process.env.DB_PORT,
        logging: false, // Set to console.log to see SQL queries
    }
);

const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
};

module.exports = { sequelize, testConnection };


// src/config/database.ts

import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { env } from './env';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
        ]
        : [{ emit: 'stdout', level: 'error' }],
});

// Log queries in development
if (env.NODE_ENV === 'development') {
    prisma.$on('query' as never, (e: any) => {
        logger.debug('Prisma Query', {
            query: e.query,
            duration: `${e.duration}ms`
        });
    });
}

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
    try {
        await prisma.$connect();
        logger.info('✅ Database connected successfully');
    } catch (error) {
        logger.error('❌ Database connection failed', { error });
        process.exit(1);
    }
}

export async function disconnectDatabase(): Promise<void> {
    await prisma.$disconnect();
    logger.info('Database disconnected');
}