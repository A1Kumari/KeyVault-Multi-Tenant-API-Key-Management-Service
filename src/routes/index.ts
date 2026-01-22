// src/routes/index.ts

import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { apiKeysRoutes } from './keys.routes';
import { auditRoutes } from './audit.routes';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API info
router.get('/', (_req, res) => {
    res.json({
        name: 'KeyVault API',
        version: '1.0.0',
        documentation: '/api/docs'
    });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/keys', apiKeysRoutes);
router.use('/audit', auditRoutes);

export { router as apiRoutes };