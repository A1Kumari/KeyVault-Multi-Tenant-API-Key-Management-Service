import 'dotenv/config';
import { createApp } from './app';
import { connectDatabase, syncDatabase, closeDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { env } from './config/env';

const PORT = env.PORT;

const gracefulShutdown = async (signal: string): Promise<void> => {
    console.log(`\n[SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

    try {
        await closeDatabase();
        await closeRedis();
        console.log('[SHUTDOWN] Graceful shutdown completed');
        process.exit(0);
    } catch (error: any) {
        console.error('[SHUTDOWN] Error during shutdown:', error.message);
        process.exit(1);
    }
};

const startServer = async (): Promise<void> => {
    console.log(`[SERVER] Environment: ${env.NODE_ENV}`);

    try {
        // Connect to database
        await connectDatabase();
        await syncDatabase();

        // Create and start app
        const app = createApp();

        const server = app.listen(PORT, () => {
            console.log('═'.repeat(50));
            console.log(`✅ Server running on http://localhost:${PORT}`);
            console.log(`📚 API Docs: http://localhost:${PORT}/api/v1`);
            console.log('═'.repeat(50));
        });

        // Graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error: any) {
        console.error('[SERVER] Failed to start:', error.message);
        process.exit(1);
    }
};

startServer();