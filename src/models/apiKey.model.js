const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

console.log('🔑 [MODEL] Initializing ApiKey model...');

const ApiKey = sequelize.define('ApiKey', {
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    // Foreign key to tenant
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'tenant_id',
        references: {
            model: 'tenants',
            key: 'id'
        }
    },
    // Hashed key (never store plain key)
    keyHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'key_hash'
    },
    // Prefix for quick lookups (e.g., "kv_live_a1b2c3d4")
    prefix: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    // Human-readable name
    name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    // Rate limit (requests per minute)
    rateLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 1000,
        field: 'rate_limit'
    },
    // Scopes/permissions array
    scopes: {
        type: DataTypes.JSON,
        defaultValue: ['read'],
        get() {
            const value = this.getDataValue('scopes');
            return value || [];
        }
    },
    // Expiration date (null = never expires)
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at'
    },
    // Last time the key was used
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
    },
    // Total usage count
    usageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'usage_count'
    },
    // Active status (soft delete alternative)
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    // Revocation status
    isRevoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_revoked'
    },
    // When the key was revoked
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
    },
    // Reason for revocation
    revokedReason: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'revoked_reason'
    },
    // User who created this key
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'created_by'
    },
    // Additional metadata (JSON)
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        get() {
            const value = this.getDataValue('metadata');
            return value || {};
        }
    },
    // IP whitelist (optional)
    allowedIps: {
        type: DataTypes.JSON,
        defaultValue: null,
        field: 'allowed_ips',
        get() {
            const value = this.getDataValue('allowedIps');
            return value || null;
        }
    },
    // Environment (live/test)
    environment: {
        type: DataTypes.ENUM('live', 'test'),
        defaultValue: 'live'
    }
}, {
    timestamps: true,
    tableName: 'api_keys',
    underscored: true,
    indexes: [
        { fields: ['prefix'], unique: true },
        { fields: ['tenant_id', 'is_revoked'] },
        { fields: ['tenant_id', 'is_active'] },
        { fields: ['expires_at'] },
        { fields: ['last_used_at'] },
        { fields: ['created_by'] }
    ]
});

// ===========================================
// Instance Methods
// ===========================================

/**
 * Check if the key is expired
 * @returns {boolean}
 */
ApiKey.prototype.isExpired = function () {
    if (!this.expiresAt) return false; // null = never expires
    return new Date() > new Date(this.expiresAt);
};

/**
 * Check if the key is valid (active, not revoked, not expired)
 * @returns {boolean}
 */
ApiKey.prototype.isValid = function () {
    return this.isActive && !this.isRevoked && !this.isExpired();
};

/**
 * Check if key has all required scopes
 * @param {string[]} requiredScopes - Array of required scopes
 * @returns {boolean}
 */
ApiKey.prototype.hasScopes = function (requiredScopes = []) {
    if (!requiredScopes || requiredScopes.length === 0) return true;
    const keyScopes = this.scopes || [];
    return requiredScopes.every(scope => keyScopes.includes(scope));
};

/**
 * Check if a specific scope exists
 * @param {string} scope - Scope to check
 * @returns {boolean}
 */
ApiKey.prototype.hasScope = function (scope) {
    const keyScopes = this.scopes || [];
    return keyScopes.includes(scope);
};

/**
 * Get time until expiration
 * @returns {Object|null}
 */
ApiKey.prototype.getTimeUntilExpiry = function () {
    if (!this.expiresAt) return null; // Never expires

    const now = new Date();
    const expiry = new Date(this.expiresAt);
    const diffMs = expiry - now;

    if (diffMs <= 0) {
        return {
            expired: true,
            ms: 0,
            seconds: 0,
            minutes: 0,
            hours: 0,
            days: 0
        };
    }

    return {
        expired: false,
        ms: diffMs,
        seconds: Math.floor(diffMs / 1000),
        minutes: Math.floor(diffMs / 1000 / 60),
        hours: Math.floor(diffMs / 1000 / 60 / 60),
        days: Math.floor(diffMs / 1000 / 60 / 60 / 24)
    };
};

/**
 * Get the current status of the key
 * @returns {string}
 */
ApiKey.prototype.getStatus = function () {
    if (this.isRevoked) return 'revoked';
    if (!this.isActive) return 'inactive';
    if (this.isExpired()) return 'expired';

    const expiry = this.getTimeUntilExpiry();
    if (expiry && expiry.days <= 7) return 'expiring_soon';

    return 'active';
};

/**
 * Check if IP is allowed (if IP whitelist is enabled)
 * @param {string} ip - IP address to check
 * @returns {boolean}
 */
ApiKey.prototype.isIpAllowed = function (ip) {
    const allowedIps = this.allowedIps;
    if (!allowedIps || allowedIps.length === 0) return true; // No whitelist = all allowed
    return allowedIps.includes(ip);
};

/**
 * Get safe public representation (no sensitive data)
 * @returns {Object}
 */
ApiKey.prototype.toPublicJSON = function () {
    return {
        id: this.id,
        name: this.name,
        prefix: this.prefix,
        scopes: this.scopes,
        rateLimit: this.rateLimit,
        environment: this.environment,
        expiresAt: this.expiresAt,
        expiresIn: this.getTimeUntilExpiry(),
        status: this.getStatus(),
        isActive: this.isActive,
        isRevoked: this.isRevoked,
        lastUsedAt: this.lastUsedAt,
        usageCount: this.usageCount,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
    };
};

// ===========================================
// Class/Static Methods
// ===========================================

/**
 * Find key by prefix
 * @param {string} prefix - Key prefix
 * @returns {Promise<ApiKey|null>}
 */
ApiKey.findByPrefix = async function (prefix) {
    return this.findOne({ where: { prefix } });
};

/**
 * Find all active keys for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<ApiKey[]>}
 */
ApiKey.findActiveByTenant = async function (tenantId) {
    return this.findAll({
        where: {
            tenantId,
            isActive: true,
            isRevoked: false
        }
    });
};

/**
 * Count active keys for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<number>}
 */
ApiKey.countActiveByTenant = async function (tenantId) {
    return this.count({
        where: {
            tenantId,
            isActive: true,
            isRevoked: false
        }
    });
};

console.log('✅ [MODEL] ApiKey model initialized with instance methods\n');

module.exports = ApiKey;