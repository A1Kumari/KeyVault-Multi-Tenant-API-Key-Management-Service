const express = require('express');
const router = express.Router();
const keyController = require('../controllers/keyController');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const keyService = require('../services/keyService'); // For verify endpoint
const { UsageLog } = require('../models');

// Protected routes (Tenant Management)
router.post('/', authMiddleware, keyController.create);
router.get('/', authMiddleware, keyController.list);
router.get('/:id', authMiddleware, keyController.get);
router.patch('/:id', authMiddleware, keyController.update);
router.delete('/:id', authMiddleware, keyController.delete);
router.post('/:id/rotate', authMiddleware, keyController.rotate);

// Public/Verification route (Used by other services to verify keys)
// This endpoint itself might need rate limiting by IP to prevent abuse
router.post('/verify', async (req, res) => {
    try {
        const { key } = req.body;
        if (!key) return res.status(400).json({ valid: false, error: 'Key required' });

        // 1. Verify Key validity (Crypto check)
        const verification = await keyService.verifyKey(key);

        if (!verification.valid) {
            return res.status(200).json({ valid: false, error: verification.error });
        }

        const apiKey = verification.key;

        // 2. Check Rate Limit (Redis)
        // Implemented in next step via rateLimiter middleware logic but called explicitly here 
        // because this is a "check" endpoint, not a middleware for THIS endpoint. 
        // BUT usually verify endpoint *consumes* the limit of the key being verified.

        // We need to inject the keyId into the request for the rate limiter if we were using middleware.
        // However, since we are inside the controller/route logic, we can call the rate limiter logic helper directly.
        // For now, let's assume we implement the logic here or usage helper.

        const rateLimitResult = await rateLimiter.checkLimit(apiKey.id, apiKey.rateLimit);

        if (!rateLimitResult.allowed) {
            return res.status(429).json({
                valid: false,
                code: 'RATE_LIMITED',
                error: 'Rate limit exceeded',
                retryAfter: rateLimitResult.retryAfter
            });
        }

        // 3. Log Analytics (Async)
        // Fire and forget - don't await to keep latency low
        UsageLog.create({
            keyId: apiKey.id,
            endpoint: 'verify',
            status: 200,
            timestamp: new Date()
        }).catch(err => console.error('Analytics Error:', err));

        res.json({
            valid: true,
            keyId: apiKey.id,
            tenantId: apiKey.tenantId,
            name: apiKey.name,
            scopes: apiKey.scopes,
            rateLimit: {
                limit: apiKey.rateLimit,
                remaining: rateLimitResult.remaining,
                reset: rateLimitResult.reset
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ valid: false, error: 'Internal server error' });
    }
});

module.exports = router;
