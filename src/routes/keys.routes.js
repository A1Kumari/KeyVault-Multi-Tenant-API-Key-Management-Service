const express = require('express');
const router = express.Router();
const keyController = require('../controllers/keyController');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const keyService = require('../services/keyService');
const { UsageLog } = require('../models');

console.log('🔑 [KEYS ROUTES] Initializing API Keys routes...');

// ===========================================
// Route Configuration Constants
// ===========================================
const ROUTE_PREFIX = '/api/keys';
const SENSITIVE_FIELDS = ['key', 'secret', 'token'];

// ===========================================
// Helper Functions
// ===========================================

/**
 * Sanitize key data for logging (mask sensitive info)
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
const sanitizeForLogging = (data) => {
    if (!data) return data;

    const sanitized = { ...data };
    SENSITIVE_FIELDS.forEach(field => {
        if (sanitized[field]) {
            // Show first 8 and last 4 characters for debugging
            const value = sanitized[field];
            if (value.length > 12) {
                sanitized[field] = `${value.substring(0, 8)}...${value.substring(value.length - 4)}`;
            } else {
                sanitized[field] = '***REDACTED***';
            }
        }
    });
    return sanitized;
};

/**
 * Log usage analytics asynchronously (fire and forget)
 * @param {Object} logData - Data to log
 */
const logUsageAsync = (logData) => {
    const startTime = Date.now();

    UsageLog.create({
        ...logData,
        timestamp: new Date()
    })
        .then(() => {
            const duration = Date.now() - startTime;
            console.log(`📊 [ANALYTICS] Usage logged for keyId: ${logData.keyId} (${duration}ms)`);
        })
        .catch(err => {
            console.error(`❌ [ANALYTICS] Failed to log usage for keyId: ${logData.keyId}`);
            console.error(`❌ [ANALYTICS] Error: ${err.message}`);
        });
};

// ===========================================
// Request Logging Middleware for Keys Routes
// ===========================================
router.use((req, res, next) => {
    console.log(`🔑 [KEYS] ${req.method} ${ROUTE_PREFIX}${req.path}`);
    next();
});

// ===========================================
// Protected Routes (Tenant Management)
// Requires Authentication
// ===========================================
console.log('   📌 [PROTECTED ROUTES] Setting up authenticated routes...');

/**
 * @route   POST /api/keys
 * @desc    Create a new API key
 * @access  Protected (requires auth)
 */
router.post('/', authMiddleware, (req, res, next) => {
    console.log(`🆕 [KEYS] Creating new API key for tenant: ${req.user?.tenantId || 'unknown'}`);
    console.log(`   └── 📋 Request body:`, sanitizeForLogging(req.body));
    next();
}, keyController.create);
console.log('      ├── POST   /           - Create new API key');

/**
 * @route   GET /api/keys
 * @desc    List all API keys for tenant
 * @access  Protected (requires auth)
 */
router.get('/', authMiddleware, (req, res, next) => {
    console.log(`📋 [KEYS] Listing API keys for tenant: ${req.user?.tenantId || 'unknown'}`);
    if (Object.keys(req.query).length > 0) {
        console.log(`   └── 🔍 Query params:`, req.query);
    }
    next();
}, keyController.list);
console.log('      ├── GET    /           - List all API keys');

/**
 * @route   GET /api/keys/:id
 * @desc    Get a specific API key by ID
 * @access  Protected (requires auth)
 */
router.get('/:id', authMiddleware, (req, res, next) => {
    console.log(`🔍 [KEYS] Getting API key: ${req.params.id}`);
    console.log(`   └── 👤 Requested by tenant: ${req.user?.tenantId || 'unknown'}`);
    next();
}, keyController.get);
console.log('      ├── GET    /:id        - Get API key by ID');

/**
 * @route   PATCH /api/keys/:id
 * @desc    Update an API key
 * @access  Protected (requires auth)
 */
router.patch('/:id', authMiddleware, (req, res, next) => {
    console.log(`✏️ [KEYS] Updating API key: ${req.params.id}`);
    console.log(`   ├── 👤 Updated by tenant: ${req.user?.tenantId || 'unknown'}`);
    console.log(`   └── 📋 Update data:`, sanitizeForLogging(req.body));
    next();
}, keyController.update);
console.log('      ├── PATCH  /:id        - Update API key');

/**
 * @route   DELETE /api/keys/:id
 * @desc    Delete/Revoke an API key
 * @access  Protected (requires auth)
 */
router.delete('/:id', authMiddleware, (req, res, next) => {
    console.log(`🗑️ [KEYS] Deleting API key: ${req.params.id}`);
    console.log(`   └── 👤 Deleted by tenant: ${req.user?.tenantId || 'unknown'}`);
    next();
}, keyController.delete);
console.log('      ├── DELETE /:id        - Delete API key');

/**
 * @route   POST /api/keys/:id/rotate
 * @desc    Rotate an API key (generate new secret)
 * @access  Protected (requires auth)
 */
router.post('/:id/rotate', authMiddleware, (req, res, next) => {
    console.log(`🔄 [KEYS] Rotating API key: ${req.params.id}`);
    console.log(`   └── 👤 Rotated by tenant: ${req.user?.tenantId || 'unknown'}`);
    next();
}, keyController.rotate);
console.log('      └── POST   /:id/rotate - Rotate API key');

// ===========================================
// Public/Verification Route
// Used by other services to verify API keys
// ===========================================
console.log('   📌 [PUBLIC ROUTES] Setting up verification endpoint...');

/**
 * @route   POST /api/keys/verify
 * @desc    Verify an API key's validity and check rate limits
 * @access  Public (but should be rate limited by IP)
 * 
 * This endpoint:
 * 1. Validates the key cryptographically
 * 2. Checks rate limits via Redis
 * 3. Logs usage analytics asynchronously
 * 4. Returns key metadata and rate limit info
 */
router.post('/verify', async (req, res) => {
    const requestStartTime = Date.now();
    const requestId = req.requestId || `verify_${Date.now()}`;

    console.log('═'.repeat(50));
    console.log(`🔐 [VERIFY] Key verification request started`);
    console.log(`   └── 📝 Request ID: ${requestId}`);

    try {
        // ===========================================
        // Step 1: Validate Request Body
        // ===========================================
        const { key } = req.body;

        if (!key) {
            console.warn(`⚠️ [VERIFY] Missing key in request body`);
            console.log(`   └── ⏱️ Duration: ${Date.now() - requestStartTime}ms`);

            return res.status(400).json({
                valid: false,
                error: 'Key required',
                code: 'MISSING_KEY',
                timestamp: new Date().toISOString()
            });
        }

        console.log(`   ├── 🔑 Key received: ${sanitizeForLogging({ key }).key}`);

        // ===========================================
        // Step 2: Cryptographic Key Verification
        // ===========================================
        console.log(`   ├── 🔍 Verifying key cryptographically...`);
        const verifyStartTime = Date.now();

        const verification = await keyService.verifyKey(key);
        const verifyDuration = Date.now() - verifyStartTime;

        console.log(`   ├── ⏱️ Verification took: ${verifyDuration}ms`);

        if (!verification.valid) {
            console.warn(`⚠️ [VERIFY] Key verification failed: ${verification.error}`);
            console.log(`   └── ⏱️ Total duration: ${Date.now() - requestStartTime}ms`);

            // Log failed verification attempt
            logUsageAsync({
                keyId: null,
                endpoint: 'verify',
                status: 401,
                errorCode: verification.error,
                ipAddress: req.ip
            });

            return res.status(200).json({
                valid: false,
                error: verification.error,
                code: 'INVALID_KEY',
                timestamp: new Date().toISOString()
            });
        }

        const apiKey = verification.key;
        console.log(`   ├── ✅ Key verified for keyId: ${apiKey.id}`);
        console.log(`   ├── 👤 Tenant ID: ${apiKey.tenantId}`);
        console.log(`   ├── 📛 Key name: ${apiKey.name}`);

        // ===========================================
        // Step 3: Rate Limit Check (Redis)
        // ===========================================
        console.log(`   ├── 🚦 Checking rate limits...`);
        const rateLimitStartTime = Date.now();

        const rateLimitResult = await rateLimiter.checkLimit(apiKey.id, apiKey.rateLimit);
        const rateLimitDuration = Date.now() - rateLimitStartTime;

        console.log(`   ├── ⏱️ Rate limit check took: ${rateLimitDuration}ms`);
        console.log(`   ├── 📊 Rate limit status: ${rateLimitResult.remaining}/${apiKey.rateLimit} remaining`);

        if (!rateLimitResult.allowed) {
            console.warn(`⚠️ [VERIFY] Rate limit exceeded for keyId: ${apiKey.id}`);
            console.log(`   ├── 🔄 Retry after: ${rateLimitResult.retryAfter}s`);
            console.log(`   └── ⏱️ Total duration: ${Date.now() - requestStartTime}ms`);

            // Log rate limited request
            logUsageAsync({
                keyId: apiKey.id,
                endpoint: 'verify',
                status: 429,
                errorCode: 'RATE_LIMITED',
                ipAddress: req.ip
            });

            return res.status(429).json({
                valid: false,
                code: 'RATE_LIMITED',
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter,
                rateLimit: {
                    limit: apiKey.rateLimit,
                    remaining: 0,
                    reset: rateLimitResult.reset
                },
                timestamp: new Date().toISOString()
            });
        }

        // ===========================================
        // Step 4: Log Analytics (Fire and Forget)
        // ===========================================
        console.log(`   ├── 📊 Logging usage analytics...`);

        logUsageAsync({
            keyId: apiKey.id,
            endpoint: 'verify',
            status: 200,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        // ===========================================
        // Step 5: Return Success Response
        // ===========================================
        const totalDuration = Date.now() - requestStartTime;

        console.log(`   ├── ✅ Verification successful!`);
        console.log(`   └── ⏱️ Total duration: ${totalDuration}ms`);
        console.log('═'.repeat(50));

        // Set rate limit headers
        res.set({
            'X-RateLimit-Limit': apiKey.rateLimit,
            'X-RateLimit-Remaining': rateLimitResult.remaining,
            'X-RateLimit-Reset': rateLimitResult.reset,
            'X-Request-ID': requestId
        });

        return res.status(200).json({
            valid: true,
            keyId: apiKey.id,
            tenantId: apiKey.tenantId,
            name: apiKey.name,
            scopes: apiKey.scopes,
            rateLimit: {
                limit: apiKey.rateLimit,
                remaining: rateLimitResult.remaining,
                reset: rateLimitResult.reset
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const totalDuration = Date.now() - requestStartTime;

        console.error('═'.repeat(50));
        console.error(`❌ [VERIFY] Verification error occurred`);
        console.error(`   ├── 📝 Request ID: ${requestId}`);
        console.error(`   ├── ❌ Error name: ${error.name}`);
        console.error(`   ├── ❌ Error message: ${error.message}`);
        console.error(`   ├── ⏱️ Duration: ${totalDuration}ms`);

        if (process.env.NODE_ENV === 'development') {
            console.error(`   └── 📚 Stack trace:`, error.stack);
        }
        console.error('═'.repeat(50));

        // Log error for analytics
        logUsageAsync({
            keyId: null,
            endpoint: 'verify',
            status: 500,
            errorCode: error.name,
            errorMessage: error.message,
            ipAddress: req.ip
        });

        return res.status(500).json({
            valid: false,
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            requestId,
            timestamp: new Date().toISOString()
        });
    }
});
console.log('      └── POST   /verify     - Verify API key (public)');

// ===========================================
// Route Statistics (Development Only)
// ===========================================
if (process.env.NODE_ENV === 'development') {
    /**
     * @route   GET /api/keys/stats/routes
     * @desc    Get registered routes (development only)
     * @access  Protected
     */
    router.get('/stats/routes', authMiddleware, (req, res) => {
        console.log(`📊 [KEYS] Route stats requested`);

        const routes = router.stack
            .filter(r => r.route)
            .map(r => ({
                path: r.route.path,
                methods: Object.keys(r.route.methods).map(m => m.toUpperCase())
            }));

        res.json({
            totalRoutes: routes.length,
            routes,
            timestamp: new Date().toISOString()
        });
    });
    console.log('      └── GET    /stats/routes - Route statistics (dev only)');
}

console.log('✅ [KEYS ROUTES] API Keys routes initialized successfully!\n');

module.exports = router;