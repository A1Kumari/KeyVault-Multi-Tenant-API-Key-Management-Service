import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class AuditLog extends Model {
    declare id: string;
    declare tenantId: string;
    declare userId: string | null;
    declare action: string;
    declare resourceType: string;
    declare resourceId: string | null;
    declare description: string | null;
    declare metadata: Record<string, any>;
    declare ipAddress: string | null;
    declare userAgent: string | null;
    declare requestId: string | null;
    declare status: string;
    declare errorMessage: string | null;
    declare duration: number | null;
    declare readonly createdAt: Date;

    public toPublicJSON(): any {
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
    }

    static async log(params: {
        tenantId: string;
        userId?: string | null;
        action: string;
        resourceType: string;
        resourceId?: string | null;
        description?: string | null;
        metadata?: Record<string, any>;
        ipAddress?: string | null;
        userAgent?: string | null;
        requestId?: string | null;
        status?: string;
        errorMessage?: string | null;
        duration?: number | null;
    }): Promise<AuditLog | null> {
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
        } catch (error: any) {
            console.error(`❌ [AUDIT LOG] Failed to create log: ${error.message}`);
            return null;
        }
    }

    static logAsync(params: any): void {
        setImmediate(() => {
            this.log(params).catch(err => {
                console.error(`❌ [AUDIT LOG ASYNC] Failed: ${err.message}`);
            });
        });
    }
}

AuditLog.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'tenant_id'
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id'
    },
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
    resourceType: {
        type: DataTypes.STRING(30),
        allowNull: false,
        field: 'resource_type',
        validate: {
            isIn: [['USER', 'API_KEY', 'TENANT', 'SETTINGS', 'SYSTEM']]
        }
    },
    resourceId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'resource_id'
    },
    description: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {}
    },
    ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        field: 'ip_address'
    },
    userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'user_agent'
    },
    requestId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'request_id'
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'SUCCESS',
        validate: {
            isIn: [['SUCCESS', 'FAILURE', 'PENDING', 'WARNING']]
        }
    },
    errorMessage: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        field: 'error_message'
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    sequelize,
    timestamps: true,
    updatedAt: false,
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
