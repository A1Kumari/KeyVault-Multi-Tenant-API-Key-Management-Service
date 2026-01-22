const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

console.log('📋 [MODEL] Initializing AuditLog model...');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    // Tenant this log belongs to
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'tenant_id'
    },
    // User who performed the action (null for system/anonymous actions)
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id'
    },
    // Action type
    action: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [[
                // Auth actions
                'USER_REGISTERED',
                'USER_LOGIN',
                'USER_LOGIN_FAILED',
                'USER_LOGOUT',
                'PASSWORD_CHANGED',
                'PASSWORD_RESET_REQUESTED',
                'PASSWORD_RESET_COMPLETED',
                'TOKEN_REFRESHED',
                // Key actions
                'KEY_CREATED',
                'KEY_UPDATED',
                'KEY_ROTATED',
                'KEY_REVOKED',
                'KEY_DELETED',
                'KEY_VERIFIED',
                'KEY_VERIFICATION_FAILED',
                'KEY_RATE_LIMITED',
                'KEY_EXPIRED',
                'KEY_SCOPE_DENIED',
                // Admin/Settings actions
                'SETTINGS_UPDATED',
                'TENANT_UPDATED',
                'TENANT_CREATED',
                // Generic
                'UNKNOWN'
            ]]
        }
    },
    // Type of resource affected
    resourceType: {
        type: DataTypes.STRING(30),
        allowNull: false,
        field: 'resource_type',
        validate: {
            isIn: [['USER', 'API_KEY', 'TENANT', 'SETTINGS', 'SYSTEM']]
        }
    },
    // ID of the resource affected
    resourceId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'resource_id'
    },
    // Human-readable description
    description: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    // Additional metadata (JSON)
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    // Client IP address
    ipAddress: {
        type: DataTypes.STRING(45), // Supports IPv6
        allowNull: true,
        field: 'ip_address'
    },
    // Client user agent
    userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'user_agent'
    },
    // Request ID for correlation
    requestId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'request_id'
    },
    // Status of the action
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'SUCCESS',
        validate: {
            isIn: [['SUCCESS', 'FAILURE', 'PENDING', 'WARNING']]
        }
    },
    // Error message if failed
    errorMessage: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: 'error_message'
    },
    // Duration of the action in ms (optional)
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    timestamps: true,
    updatedAt: false, // Audit logs should be immutable
    tableName: 'audit_logs',
    underscored: true,
    indexes: [
        { fields: ['tenant_id', 'created_at'] },
        { fields: ['user_id', 'created_at'] },
        { fields: ['action'] },
        { fields: ['resource_type', 'resource_id'] },
        { fields: ['created_at'] },
        { fields: ['status'] },
        { fields: ['ip_address'] }
    ]
});

// ===========================================
// Instance Methods
// ===========================================

/**
 * Get safe public representation
 * @returns {Object}
 */
AuditLog.prototype.toPublicJSON = function () {
    return {
        id: this.id,
        action: this.action,
        resourceType: this.resourceType,
        resourceId: this.resourceId,
        description: this.description,
        status: this.status,
        ipAddress: this.ipAddress,
        createdAt: this.createdAt,
        metadata: this.metadata
    };
};

// ===========================================
// Class/Static Methods
// ===========================================

/**
 * Create an audit log entry (convenience method)
 * @param {Object} params - Log parameters
 * @returns {Promise<AuditLog>}
 */
AuditLog.log = async function (params) {
    const {
        tenantId,
        userId = null,
        action,
        resourceType,
        resourceId = null,
        description = null,
        metadata = {},
        ipAddress = null,
        userAgent = null,
        requestId = null,
        status = 'SUCCESS',
        errorMessage = null,
        duration = null
    } = params;

    try {
        return await this.create({
            tenantId,
            userId,
            action,
            resourceType,
            resourceId,
            description,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            },
            ipAddress,
            userAgent,
            requestId,
            status,
            errorMessage,
            duration
        });
    } catch (error) {
        console.error(`❌ [AUDIT LOG] Failed to create log: ${error.message}`);
        return null;
    }
};

/**
 * Log asynchronously (fire and forget)
 * @param {Object} params - Log parameters
 */
AuditLog.logAsync = function (params) {
    setImmediate(() => {
        this.log(params).catch(err => {
            console.error(`❌ [AUDIT LOG ASYNC] Failed: ${err.message}`);
        });
    });
};

console.log('✅ [MODEL] AuditLog model initialized\n');

module.exports = AuditLog;