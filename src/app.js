const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const keyRoutes = require('./routes/keys.routes');

const app = express();

const NODE_ENV = process.env.NODE_ENV || 'development';

console.log('📦 [APP] Initializing Express application...');

// ===========================================
// Security Middleware
// ===========================================
console.log('🛡️ [MIDDLEWARE] Setting up security middleware...');

app.use(helmet());
console.log('   ├── ✅ Helmet (security headers) enabled');

app.use(cors());
console.log('   ├── ✅ CORS enabled');

// ===========================================
// Body Parsing Middleware
// ===========================================
app.use(express.json({ limit: '10mb' }));
console.log('   ├── ✅ JSON body parser enabled (limit: 10mb)');

app.use(express.urlencoded({ extended: true, limit: '10mb' }));
console.log('   ├── ✅ URL-encoded body parser enabled');

// ===========================================
// Request Logging Middleware
// ===========================================
app.use((req, res, next) => {
    const startTime = Date.now();

    // Log incoming request
    console.log(`📥 [REQUEST] ${req.method} ${req.originalUrl}`);

    if (NODE_ENV === 'development') {
        // Log request body for non-sensitive routes in development
        if (req.body && Object.keys(req.body).length > 0) {
            // Mask sensitive fields
            const sanitizedBody = { ...req.body };
            const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'key'];
            sensitiveFields.forEach(field => {
                if (sanitizedBody[field]) {
                    sanitizedBody[field] = '***REDACTED***';
                }
            });
            console.log(`   └── 📋 Body:`, JSON.stringify(sanitizedBody));
        }
    }

    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`📤 [RESPONSE] ${statusEmoji} ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });

    next();
});
console.log('   └── ✅ Request/Response logger enabled');

// ===========================================
// Request ID Middleware (for tracing)
// ===========================================
app.use((req, res, next) => {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.requestId);
    next();
});
console.log('🔖 [MIDDLEWARE] Request ID generator enabled');

// ===========================================
// API Routes
// ===========================================
console.log('🛣️ [ROUTES] Registering API routes...');

app.use('/api/auth', authRoutes);
console.log('   ├── ✅ /api/auth - Authentication routes');

app.use('/api/keys', keyRoutes);
console.log('   ├── ✅ /api/keys - API Keys routes');

// ===========================================
// Health Check Endpoint
// ===========================================
app.get('/health', (req, res) => {
    console.log('💓 [HEALTH] Health check requested');

    const healthInfo = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        memoryUsage: {
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`,
        },
        version: process.env.npm_package_version || '1.0.0'
    };

    res.status(200).json(healthInfo);
});
console.log('   └── ✅ /health - Health check endpoint');

// ===========================================
// API Documentation Endpoint (Optional)
// ===========================================
app.get('/api', (req, res) => {
    console.log('📚 [API] API info requested');

    res.status(200).json({
        name: 'API Service',
        version: process.env.npm_package_version || '1.0.0',
        endpoints: {
            auth: '/api/auth',
            keys: '/api/keys',
            health: '/health'
        },
        documentation: '/api/docs' // If you have swagger or similar
    });
});

// ===========================================
// 404 Handler - Route Not Found
// ===========================================
app.use((req, res, next) => {
    console.warn(`⚠️ [404] Route not found: ${req.method} ${req.originalUrl}`);

    res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        statusCode: 404,
        timestamp: new Date().toISOString()
    });
});

// ===========================================
// Global Error Handling Middleware
// ===========================================
app.use((err, req, res, next) => {
    // Generate error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log error details
    console.error('═'.repeat(50));
    console.error(`❌ [ERROR] Error ID: ${errorId}`);
    console.error(`❌ [ERROR] Request ID: ${req.requestId || 'N/A'}`);
    console.error(`❌ [ERROR] Method: ${req.method}`);
    console.error(`❌ [ERROR] URL: ${req.originalUrl}`);
    console.error(`❌ [ERROR] Error Name: ${err.name}`);
    console.error(`❌ [ERROR] Error Message: ${err.message}`);

    if (NODE_ENV === 'development') {
        console.error(`❌ [ERROR] Stack Trace:`, err.stack);
    }
    console.error('═'.repeat(50));

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        statusCode = 401;
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
    } else if (err.name === 'SequelizeValidationError') {
        statusCode = 400;
    } else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
    }

    // Build error response
    const errorResponse = {
        success: false,
        error: err.name || 'Internal Server Error',
        message: NODE_ENV === 'production' && statusCode === 500
            ? 'Something went wrong!'
            : err.message,
        statusCode,
        errorId,
        timestamp: new Date().toISOString()
    };

    // Include additional details in development
    if (NODE_ENV === 'development') {
        errorResponse.stack = err.stack;
        errorResponse.requestId = req.requestId;
    }

    // Include validation errors if present
    if (err.errors) {
        errorResponse.errors = err.errors;
    }

    res.status(statusCode).json(errorResponse);
});

console.log('🚨 [MIDDLEWARE] Error handlers configured');
console.log('✅ [APP] Express application initialized successfully!\n');

module.exports = app;