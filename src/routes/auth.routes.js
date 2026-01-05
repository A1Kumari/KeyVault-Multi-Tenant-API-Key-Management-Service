const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

console.log('🔐 [AUTH ROUTES] Initializing Authentication routes...');

// ===========================================
// Configuration
// ===========================================
const ROUTE_PREFIX = '/api/auth';
const SENSITIVE_FIELDS = ['password', 'token', 'refreshToken', 'secret'];

// ===========================================
// Helper Functions
// ===========================================

/**
 * Sanitize request data for logging (mask sensitive info)
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
const sanitizeForLogging = (data) => {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    SENSITIVE_FIELDS.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '***REDACTED***';
        }
    });
    return sanitized;
};

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.ip ||
        'unknown';
};

/**
 * Log authentication attempt
 * @param {string} action - Action type (register, login, etc.)
 * @param {Object} req - Express request object
 * @param {string} status - Status (attempt, success, failure)
 * @param {Object} details - Additional details
 */
const logAuthAttempt = (action, req, status, details = {}) => {
    const timestamp = new Date().toISOString();
    const ip = getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';

    const statusEmoji = {
        'attempt': '🔄',
        'success': '✅',
        'failure': '❌',
        'blocked': '🚫'
    };

    console.log(`${statusEmoji[status] || '📝'} [AUTH] ${action.toUpperCase()} ${status}`);
    console.log(`   ├── 📍 IP: ${ip}`);
    console.log(`   ├── 🌐 User-Agent: ${userAgent.substring(0, 50)}${userAgent.length > 50 ? '...' : ''}`);
    console.log(`   ├── ⏰ Time: ${timestamp}`);

    if (details.email) {
        console.log(`   ├── 📧 Email: ${details.email}`);
    }
    if (details.userId) {
        console.log(`   ├── 🆔 User ID: ${details.userId}`);
    }
    if (details.tenantId) {
        console.log(`   ├── 🏢 Tenant ID: ${details.tenantId}`);
    }
    if (details.reason) {
        console.log(`   ├── 💬 Reason: ${details.reason}`);
    }
    if (details.requestId) {
        console.log(`   └── 📝 Request ID: ${details.requestId}`);
    } else {
        // Remove the last ├── and replace with └──
        console.log(`   └── 📝 Request ID: ${req.requestId || 'N/A'}`);
    }
};

// ===========================================
// Request Logging Middleware for Auth Routes
// ===========================================
router.use((req, res, next) => {
    // Add request timestamp for duration calculation
    req.authRequestStartTime = Date.now();

    console.log('─'.repeat(50));
    console.log(`🔐 [AUTH] ${req.method} ${ROUTE_PREFIX}${req.path}`);

    next();
});

// ===========================================
// Response Logging Middleware
// ===========================================
router.use((req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to log responses
    res.json = (data) => {
        const duration = Date.now() - req.authRequestStartTime;
        const statusEmoji = res.statusCode >= 400 ? '❌' : '✅';

        console.log(`${statusEmoji} [AUTH] Response: ${res.statusCode} (${duration}ms)`);
        console.log('─'.repeat(50));

        return originalJson(data);
    };

    next();
});

// ===========================================
// Public Routes (No Authentication Required)
// ===========================================
console.log('   📌 [PUBLIC ROUTES] Setting up public endpoints...');

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user/tenant
 * @access  Public
 * 
 * @body    {string} email - User's email address
 * @body    {string} password - User's password (min 8 chars recommended)
 * @body    {string} name - User's full name (optional)
 * @body    {string} companyName - Company/Tenant name (optional)
 * 
 * @returns {Object} - User object and JWT token
 */
router.post('/register',
    // Pre-controller logging middleware
    (req, res, next) => {
        logAuthAttempt('register', req, 'attempt', {
            email: req.body?.email,
            requestId: req.requestId
        });

        // Log sanitized request body in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`   📋 [DEBUG] Request body:`, sanitizeForLogging(req.body));
        }

        // Basic validation logging
        if (!req.body?.email) {
            console.warn(`   ⚠️ [VALIDATION] Missing email in registration request`);
        }
        if (!req.body?.password) {
            console.warn(`   ⚠️ [VALIDATION] Missing password in registration request`);
        }

        next();
    },
    // Actual controller
    authController.register
);
console.log('      ├── POST   /register   - Register new user');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 * 
 * @body    {string} email - User's email address
 * @body    {string} password - User's password
 * 
 * @returns {Object} - User object and JWT token
 */
router.post('/login',
    // Pre-controller logging middleware
    (req, res, next) => {
        logAuthAttempt('login', req, 'attempt', {
            email: req.body?.email,
            requestId: req.requestId
        });

        // Basic validation logging
        if (!req.body?.email || !req.body?.password) {
            console.warn(`   ⚠️ [VALIDATION] Missing credentials in login request`);
        }

        next();
    },
    // Actual controller
    authController.login
);
console.log('      └── POST   /login      - User login');

// ===========================================
// Protected Routes (Authentication Required)
// ===========================================
console.log('   📌 [PROTECTED ROUTES] Setting up authenticated endpoints...');

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user's profile
 * @access  Protected (requires valid JWT)
 * 
 * @header  {string} Authorization - Bearer <token>
 * 
 * @returns {Object} - Current user's profile data
 */
router.get('/me',
    // Auth middleware
    authMiddleware,
    // Pre-controller logging middleware
    (req, res, next) => {
        console.log(`👤 [AUTH] Profile request for user: ${req.user?.id || 'unknown'}`);
        console.log(`   ├── 📧 Email: ${req.user?.email || 'N/A'}`);
        console.log(`   └── 🏢 Tenant: ${req.user?.tenantId || 'N/A'}`);

        next();
    },
    // Actual controller
    authController.getMe
);
console.log('      ├── GET    /me         - Get current user profile');

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate token if using blacklist)
 * @access  Protected (requires valid JWT)
 * 
 * Note: If you're using stateless JWT, this might just be a client-side action.
 *       If you're using token blacklist/Redis, implement server-side logout.
 */
router.post('/logout',
    authMiddleware,
    (req, res, next) => {
        logAuthAttempt('logout', req, 'attempt', {
            userId: req.user?.id,
            email: req.user?.email,
            requestId: req.requestId
        });
        next();
    },
    // If you have a logout controller, use it. Otherwise, simple response:
    authController.logout || ((req, res) => {
        console.log(`✅ [AUTH] User logged out: ${req.user?.id}`);
        res.status(200).json({
            success: true,
            message: 'Logged out successfully',
            timestamp: new Date().toISOString()
        });
    })
);
console.log('      ├── POST   /logout     - User logout');

/**
 * @route   PUT /api/auth/password
 * @desc    Change user's password
 * @access  Protected (requires valid JWT)
 * 
 * @body    {string} currentPassword - User's current password
 * @body    {string} newPassword - User's new password
 */
router.put('/password',
    authMiddleware,
    (req, res, next) => {
        console.log(`🔑 [AUTH] Password change request for user: ${req.user?.id}`);
        console.log(`   └── 📧 Email: ${req.user?.email || 'N/A'}`);

        // Validation logging
        if (!req.body?.currentPassword || !req.body?.newPassword) {
            console.warn(`   ⚠️ [VALIDATION] Missing password fields in change request`);
        }

        next();
    },
    authController.changePassword || ((req, res) => {
        res.status(501).json({
            success: false,
            error: 'Password change not implemented',
            code: 'NOT_IMPLEMENTED'
        });
    })
);
console.log('      ├── PUT    /password   - Change password');

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Public (but requires valid refresh token)
 * 
 * @body    {string} refreshToken - Valid refresh token
 */
router.post('/refresh',
    (req, res, next) => {
        console.log(`🔄 [AUTH] Token refresh request`);
        console.log(`   └── 📍 IP: ${getClientIP(req)}`);

        if (!req.body?.refreshToken) {
            console.warn(`   ⚠️ [VALIDATION] Missing refresh token`);
        }

        next();
    },
    authController.refreshToken || ((req, res) => {
        res.status(501).json({
            success: false,
            error: 'Token refresh not implemented',
            code: 'NOT_IMPLEMENTED'
        });
    })
);
console.log('      └── POST   /refresh    - Refresh JWT token');

// ===========================================
// Password Reset Routes (If implemented)
// ===========================================
console.log('   📌 [PASSWORD RESET] Setting up password reset endpoints...');

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email
 * @access  Public
 * 
 * @body    {string} email - User's email address
 */
router.post('/forgot-password',
    (req, res, next) => {
        console.log(`📧 [AUTH] Password reset requested for: ${req.body?.email || 'unknown'}`);
        console.log(`   └── 📍 IP: ${getClientIP(req)}`);
        next();
    },
    authController.forgotPassword || ((req, res) => {
        // Generic response to prevent email enumeration
        console.log(`   ℹ️ [AUTH] Forgot password endpoint not implemented`);
        res.status(200).json({
            success: true,
            message: 'If an account exists with this email, a reset link will be sent',
            timestamp: new Date().toISOString()
        });
    })
);
console.log('      ├── POST   /forgot-password - Request reset email');

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public (requires valid reset token)
 * 
 * @body    {string} token - Password reset token
 * @body    {string} newPassword - New password
 */
router.post('/reset-password',
    (req, res, next) => {
        console.log(`🔐 [AUTH] Password reset attempt`);
        console.log(`   ├── 📍 IP: ${getClientIP(req)}`);
        console.log(`   └── 🎫 Token provided: ${req.body?.token ? 'Yes' : 'No'}`);
        next();
    },
    authController.resetPassword || ((req, res) => {
        res.status(501).json({
            success: false,
            error: 'Password reset not implemented',
            code: 'NOT_IMPLEMENTED'
        });
    })
);
console.log('      └── POST   /reset-password - Reset with token');

// ===========================================
// Development/Debug Routes
// ===========================================
if (process.env.NODE_ENV === 'development') {
    console.log('   📌 [DEV ROUTES] Setting up development endpoints...');

    /**
     * @route   GET /api/auth/debug/routes
     * @desc    List all auth routes (development only)
     * @access  Development only
     */
    router.get('/debug/routes', (req, res) => {
        console.log(`🔧 [AUTH] Debug routes requested`);

        const routes = router.stack
            .filter(r => r.route)
            .map(r => ({
                path: `${ROUTE_PREFIX}${r.route.path}`,
                methods: Object.keys(r.route.methods).map(m => m.toUpperCase()),
                middleware: r.route.stack.length - 1 // Subtract 1 for the actual handler
            }));

        res.json({
            success: true,
            totalRoutes: routes.length,
            routes,
            timestamp: new Date().toISOString()
        });
    });
    console.log('      └── GET    /debug/routes - List auth routes (dev)');
}

// ===========================================
// 404 Handler for Auth Routes
// ===========================================
router.use((req, res) => {
    console.warn(`⚠️ [AUTH] Route not found: ${req.method} ${ROUTE_PREFIX}${req.path}`);

    res.status(404).json({
        success: false,
        error: 'Auth endpoint not found',
        code: 'AUTH_ROUTE_NOT_FOUND',
        path: `${ROUTE_PREFIX}${req.path}`,
        availableEndpoints: [
            'POST /api/auth/register',
            'POST /api/auth/login',
            'GET /api/auth/me',
            'POST /api/auth/logout',
            'POST /api/auth/refresh',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password'
        ],
        timestamp: new Date().toISOString()
    });
});

console.log('✅ [AUTH ROUTES] Authentication routes initialized successfully!\n');

module.exports = router;