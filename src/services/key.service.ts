import crypto from 'crypto';
import { ApiKey } from '../models'; // Ensure this model exists and is typed if possible, else any
// AuditService will be refactored next, so we will import it.
// However, circular dependency might occur if AuditService uses KeyService.
// keyService.js used: const AuditService = require('./auditService');
// We will assume AuditService is available or use a placeholder/any for now until it's refactored.
// Actually, I should create AuditService first or stub it?
// The JS file used `require('./auditService')`. I will import it from `../services/audit.service` (future) or keeping it commented/any for now.
import { auditService } from './audit.service'; // We will create this next.

const KEY_PREFIX = process.env.KEY_PREFIX || 'kv';

export class KeyService {

    /**
     * Generate a new API key
     */
    async createKey(params: any) {
        const {
            tenantId,
            userId,
            name,
            scopes = ['read'],
            rateLimit = 100,
            expiresIn = null, // e.g., '30d', '90d', '1y', or null for never
            environment = 'live',
            metadata = {}
        } = params;

        // Generate random key
        const randomPart = crypto.randomBytes(32).toString('base64url');
        const prefix = `${KEY_PREFIX}_${environment}_${randomPart.substring(0, 8)}`;
        const fullKey = `${KEY_PREFIX}_${environment}_${randomPart}`;

        // Hash the key for storage
        const keyHash = this.hashKey(fullKey);

        // Calculate expiration date
        const expiresAt = expiresIn ? this.calculateExpiration(expiresIn) : null;

        // Create the key record
        const apiKey = await ApiKey.create({
            tenantId,
            name,
            prefix,
            keyHash,
            scopes,
            rateLimit,
            expiresAt,
            createdBy: userId,
            metadata: {
                ...metadata,
                environment,
                createdAt: new Date().toISOString()
            }
        });

        // Log creation (Future: use AuditService)
        // await auditService.logKeyCreated(...)

        return {
            id: apiKey.id,
            key: fullKey, // ⚠️ Only returned on creation!
            prefix: apiKey.prefix,
            name: apiKey.name,
            scopes: apiKey.scopes,
            rateLimit: apiKey.rateLimit,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
            _warning: 'Store this key securely. It will not be shown again.'
        };
    }

    /**
     * Verify an API key
     */
    async verifyKey(key: string, options: any = {}) {
        const { requiredScopes = [] } = options;
        const startTime = Date.now();

        try {
            // Step 1: Validate key format
            if (!key || typeof key !== 'string') {
                return { valid: false, error: 'INVALID_KEY_FORMAT' };
            }

            // Step 2: Extract prefix and find key
            const prefix = this.extractPrefix(key);
            if (!prefix) {
                return { valid: false, error: 'INVALID_KEY_FORMAT' };
            }

            // Step 3: Find key by prefix
            const apiKey = await ApiKey.findOne({ where: { prefix } });

            if (!apiKey) {
                return { valid: false, error: 'KEY_NOT_FOUND' };
            }

            // Step 4: Check if revoked
            if (apiKey.isRevoked) {
                return {
                    valid: false,
                    error: 'KEY_REVOKED',
                    revokedAt: apiKey.revokedAt,
                    revokedReason: apiKey.revokedReason
                };
            }

            // Step 5: Check if expired
            // Assuming apiKey model has isExpired() method or check manually
            if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
                return {
                    valid: false,
                    error: 'KEY_EXPIRED',
                    expiredAt: apiKey.expiresAt
                };
            }


            // Step 6: Verify hash
            const keyHash = this.hashKey(key);
            if (keyHash !== apiKey.keyHash) {
                return { valid: false, error: 'INVALID_KEY' };
            }

            // Step 7: Check scopes
            // Assuming apiKey has scopes array
            if (requiredScopes.length > 0) {
                const hasAllScopes = requiredScopes.every((scope: string) => apiKey.scopes.includes(scope));
                if (!hasAllScopes) {
                    return {
                        valid: false,
                        error: 'INSUFFICIENT_SCOPES',
                        requiredScopes,
                        availableScopes: apiKey.scopes
                    };
                }
            }

            // Step 8: Update last used timestamp (async)
            this.updateLastUsed(apiKey.id);

            return {
                valid: true,
                key: {
                    id: apiKey.id,
                    tenantId: apiKey.tenantId,
                    name: apiKey.name,
                    prefix: apiKey.prefix,
                    scopes: apiKey.scopes,
                    rateLimit: apiKey.rateLimit,
                    expiresAt: apiKey.expiresAt,
                    // expiresIn: apiKey.getTimeUntilExpiry() // Helper?
                }
            };

        } catch (error: any) {
            console.error('❌ [KEY SERVICE] Verification error:', error.message);
            return { valid: false, error: 'VERIFICATION_ERROR' };
        }
    }

    /**
     * Rotate an API key
     */
    async rotateKey(keyId: string, tenantId: string, userId: string) {
        const apiKey = await ApiKey.findOne({
            where: { id: keyId, tenantId, isRevoked: false }
        });

        if (!apiKey) {
            throw new Error('Key not found or already revoked');
        }

        // Generate new key
        const environment = apiKey.metadata?.environment || 'live';
        const randomPart = crypto.randomBytes(32).toString('base64url');
        const newPrefix = `${KEY_PREFIX}_${environment}_${randomPart.substring(0, 8)}`;
        const newFullKey = `${KEY_PREFIX}_${environment}_${randomPart}`;
        const newKeyHash = this.hashKey(newFullKey);

        // Update the key
        await apiKey.update({
            prefix: newPrefix,
            keyHash: newKeyHash,
            metadata: {
                ...apiKey.metadata,
                rotatedAt: new Date().toISOString(),
                rotationCount: (apiKey.metadata?.rotationCount || 0) + 1
            }
        });

        return {
            id: apiKey.id,
            key: newFullKey, // ⚠️ Only returned on rotation!
            prefix: newPrefix,
            name: apiKey.name,
            scopes: apiKey.scopes,
            rateLimit: apiKey.rateLimit,
            _warning: 'Store this key securely. It will not be shown again.'
        };
    }

    /**
     * Revoke an API key
     */
    async revokeKey(keyId: string, tenantId: string, reason: string | null = null) {
        const apiKey = await ApiKey.findOne({
            where: { id: keyId, tenantId }
        });

        if (!apiKey) {
            throw new Error('Key not found');
        }

        if (apiKey.isRevoked) {
            throw new Error('Key is already revoked');
        }

        await apiKey.update({
            isRevoked: true,
            revokedAt: new Date(),
            revokedReason: reason
        });

        return {
            id: apiKey.id,
            name: apiKey.name,
            isRevoked: true,
            revokedAt: apiKey.revokedAt,
            revokedReason: reason
        };
    }

    /**
     * List keys for a tenant
     */
    async listKeys(tenantId: string, options: any = {}) {
        const {
            page = 1,
            limit = 20,
            includeRevoked = false,
            includeExpired = false
        } = options;

        const where: any = { tenantId };

        if (!includeRevoked) {
            where.isRevoked = false;
        }

        const { count, rows } = await ApiKey.findAndCountAll({
            where,
            attributes: { exclude: ['keyHash'] }, // Never return hash
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });

        // Filter expired if needed
        let keys = rows;
        if (!includeExpired) {
            keys = rows.filter((key: any) => {
                if (!key.expiresAt) return true;
                return new Date(key.expiresAt) > new Date();
            });
        }

        // Add status to each key
        keys = keys.map((key: any) => ({
            ...key.toJSON(),
            status: this.getKeyStatus(key),
            // expiresIn: key.getTimeUntilExpiry()
        }));

        return {
            keys,
            pagination: {
                total: count,
                page,
                limit,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    async getKey(tenantId: string, keyId: string) {
        const apiKey = await ApiKey.findOne({ where: { id: keyId, tenantId }, attributes: { exclude: ['keyHash'] } });
        if (!apiKey) throw new Error("Key not found");
        return {
            ...apiKey.toJSON(),
            status: this.getKeyStatus(apiKey)
        };
    }

    async updateKey(tenantId: string, keyId: string, updates: any) {
        const apiKey = await ApiKey.findOne({ where: { id: keyId, tenantId } });
        if (!apiKey) throw new Error("Key not found");
        await apiKey.update(updates);
        return apiKey;
    }

    async deleteKey(tenantId: string, keyId: string) {
        // Soft delete/revoke
        return this.revokeKey(keyId, tenantId, "Deleted by user");
    }

    // ========== HELPER METHODS ==========

    /**
     * Hash a key using SHA-256
     */
    hashKey(key: string) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    /**
     * Extract prefix from full key
     */
    extractPrefix(key: string) {
        // Key format: kv_live_xxxxxxxx...
        const parts = key.split('_');
        if (parts.length < 3) return null;
        // Get prefix + environment + first 8 chars of random
        const randomPart = parts.slice(2).join('_').substring(0, 8);
        const prefix = `${parts[0]}_${parts[1]}_${randomPart}`;
        return prefix;
    }

    /**
     * Calculate expiration date from duration string
     */
    calculateExpiration(duration: string) {
        const now = new Date();
        const match = duration.match(/^(\d+)([dhmy])$/);

        if (!match) {
            throw new Error('Invalid duration format. Use: 30d, 90d, 1y, etc.');
        }

        const [, amount, unit] = match;
        const num = parseInt(amount);

        switch (unit) {
            case 'd': // days
                return new Date(now.setDate(now.getDate() + num));
            case 'h': // hours
                return new Date(now.setHours(now.getHours() + num));
            case 'm': // months
                return new Date(now.setMonth(now.getMonth() + num));
            case 'y': // years
                return new Date(now.setFullYear(now.getFullYear() + num));
            default:
                throw new Error('Invalid duration unit');
        }
    }

    /**
     * Get key status string
     */
    getKeyStatus(key: any) {
        if (key.isRevoked) return 'revoked';
        if (key.expiresAt && new Date() > new Date(key.expiresAt)) return 'expired';

        // simple check
        return 'active';
    }

    /**
     * Update last used timestamp (async)
     */
    updateLastUsed(keyId: string) {
        // setImmediate(async () => {
        // Use proper direct call or task queue. setImmediate in TS might need bind?
        // For now, simpler invocation:
        ApiKey.update(
            {
                lastUsedAt: new Date(),
                // usageCount: sequelize.literal('usage_count + 1') // Need Sequelize import for literal
            },
            { where: { id: keyId } }
        ).catch((err: any) => console.error("Failed to update last used", err));
        // });
    }
}

export const keyService = new KeyService();
