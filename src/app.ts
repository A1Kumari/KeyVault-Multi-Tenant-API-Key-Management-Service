// src/app.ts

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { env, connectDatabase, logger } from './config';
import { apiRoutes } from './routes';
import { requestLogger } from './middleware/requestLogger.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';

async function createApp(): Promise<Express> {
    const app = express();

    // ═══════════════════════════════════════════════════════════════
    // SECURITY MIDDLEWARE
    // ═══════════════════════════════════════════════════════════════
    app.use(helmet());
    app.use(cors({
        origin: env.NODE_ENV === 'production'
            ? process.env.ALLOWED_ORIGINS?.split(',')
            : '*',
        credentials: true
    }));

    // ═══════════════════════════════════════════════════════════════
    // BODY PARSING
    // ═══════════════════════════════════════════════════════════════
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(compression());

    // ═══════════════════════════════════════════════════════════════
    // REQUEST LOGGING
    // ═══════════════════════════════════════════════════════════════
    app.use(requestLogger);

    // ═══════════════════════════════════════════════════════════════
    // ROUTES
    // ═══════════════════════════════════════════════════════════════
    app.use('/api', apiRoutes);

    // ═══════════════════════════════════════════════════════════════
    // ERROR HANDLING
    // ═══════════════════════════════════════════════════════════════
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}

async function startServer(): Promise<void> {
    try {
        // Connect to database
        await connectDatabase();

        // Create Express app
        const app = await createApp();

        // Start server
        app.listen(env.PORT, () => {
            logger.info(`🚀 Server running on port ${env.PORT}`);
            logger.info(`📍 Environment: ${env.NODE_ENV}`);
            logger.info(`🔗 API: http://localhost:${env.PORT}/api`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start server', { error });
        process.exit(1);
    }
}

startServer();

export { createApp };