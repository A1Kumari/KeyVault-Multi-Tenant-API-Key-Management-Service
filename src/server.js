require('dotenv').config();

const app = require('./app');
const { sequelize, syncDatabase } = require('./models');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal) => {
    console.log(`\n [SHUTDOWN] Received ${signal}. Starting graceful shutdown...`);

    try {
        // Close database connection
        console.log('[DATABASE] Closing database connection...');
        await sequelize.close();
        console.log('[DATABASE] Database connection closed successfully');

        // Close Redis connection if it exists
        if (redis && redis.quit) {
            console.log('[REDIS] Closing Redis connection...');
            await redis.quit();
            console.log('[REDIS] Redis connection closed successfully');
        }

        console.log('[SHUTDOWN] Graceful shutdown completed. Goodbye!');
        process.exit(0);
    } catch (error) {
        console.error(' [SHUTDOWN] Error during graceful shutdown:', error.message);
        process.exit(1);
    }
};

/**
 * Main server startup function
 */
const startServer = async () => {
    console.log(' [SERVER] Starting server initialization...');
    console.log(`[SERVER] Environment: ${NODE_ENV}`);
    console.log(`[SERVER] Startup time: ${new Date().toISOString()}`);

    try {
        // Step 1: Database connection
        console.log('\n [DATABASE] Attempting to connect to database...');
        const startDbTime = Date.now();
        await sequelize.authenticate();
        const dbConnectionTime = Date.now() - startDbTime;
        console.log(`[DATABASE] Database connected successfully (${dbConnectionTime}ms)`);

        // Step 2: Sync models
        console.log('\n [DATABASE] Syncing database models...');
        const startSyncTime = Date.now();
        await syncDatabase();
        const syncTime = Date.now() - startSyncTime;
        console.log(`[DATABASE] Models synced successfully (${syncTime}ms)`);

        // Step 3: Verify Redis connection (optional - depends on your setup)
        if (redis) {
            console.log('\n [REDIS] Checking Redis connection...');
            try {
                // If redis has a ping method, use it to verify connection
                if (redis.ping) {
                    await redis.ping();
                    console.log(' [REDIS] Redis connected successfully');
                } else {
                    console.log(' [REDIS] Redis client loaded (connection status unknown)');
                }
            } catch (redisError) {
                console.warn(' [REDIS] Redis connection failed:', redisError.message);
                console.warn(' [REDIS] Server will continue without Redis caching');
            }
        }

        // Step 4: Start Express server
        console.log('\n [SERVER] Starting HTTP server...');
        const server = app.listen(PORT, () => {
            console.log('═'.repeat(50));
            console.log(` [SERVER] Server is running successfully!`);
            console.log(` [SERVER] Local: http://localhost:${PORT}`);
            console.log(` [SERVER] Environment: ${NODE_ENV}`);
            console.log(` [SERVER] Started at: ${new Date().toLocaleString()}`);
            console.log('═'.repeat(50));
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(` [SERVER] Port ${PORT} is already in use`);
            } else {
                console.error(' [SERVER] Server error:', error.message);
            }
            process.exit(1);
        });

        // Setup graceful shutdown handlers
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        console.error('\n [SERVER] Failed to start server');
        console.error(' [ERROR] Error name:', error.name);
        console.error(' [ERROR] Error message:', error.message);

        if (NODE_ENV === 'development') {
            console.error(' [ERROR] Stack trace:', error.stack);
        }

        // Provide helpful error messages based on error type
        if (error.name === 'SequelizeConnectionRefusedError') {
            console.error('[HINT] Make sure your database server is running');
        } else if (error.name === 'SequelizeAccessDeniedError') {
            console.error(' [HINT] Check your database credentials in .env file');
        } else if (error.name === 'SequelizeHostNotFoundError') {
            console.error('[HINT] Check your database host configuration');
        }

        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION] Unhandled Promise Rejection:');
    console.error(' [UNHANDLED REJECTION] Reason:', reason);
    // In production, you might want to exit the process
    // process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('[UNCAUGHT EXCEPTION] Uncaught Exception:');
    console.error('[UNCAUGHT EXCEPTION] Error:', error.message);
    console.error('[UNCAUGHT EXCEPTION] Stack:', error.stack);
    process.exit(1);
});

// Start the server
startServer();