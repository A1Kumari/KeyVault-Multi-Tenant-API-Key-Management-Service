import { Model, DataTypes, Op } from 'sequelize';
import { sequelize } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class ApiKey extends Model {
    declare id: string;
    declare tenantId: string;
    declare keyHash: string;
    declare prefix: string;
    declare name: string | null;
    declare rateLimit: number;
    declare scopes: string[];
    declare expiresAt: Date | null;
    declare lastUsedAt: Date | null;
    declare usageCount: number;
    declare isActive: boolean;
    declare isRevoked: boolean;
    declare revokedAt: Date | null;
    declare revokedReason: string | null;
    declare createdBy: string | null;
    declare metadata: Record<string, any>;
    declare allowedIps: string[] | null;
    declare environment: 'live' | 'test';
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    // Instance Methods
    public isExpired(): boolean {
        if (!this.expiresAt) return false;
        return new Date() > new Date(this.expiresAt);
    }

    public isValid(): boolean {
        return this.isActive && !this.isRevoked && !this.isExpired();
    }

    public hasScopes(requiredScopes: string[] = []): boolean {
        if (!requiredScopes || requiredScopes.length === 0) return true;
        const keyScopes = this.scopes || [];
        return requiredScopes.every(scope => keyScopes.includes(scope));
    }

    public hasScope(scope: string): boolean {
        const keyScopes = this.scopes || [];
        return keyScopes.includes(scope);
    }

    public getTimeUntilExpiry(): any {
        if (!this.expiresAt) return null;

        const now = new Date();
        const expiry = new Date(this.expiresAt);
        const diffMs = expiry.getTime() - now.getTime();

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
    }

    public getStatus(): string {
        if (this.isRevoked) return 'revoked';
        if (!this.isActive) return 'inactive';
        if (this.isExpired()) return 'expired';

        const expiry = this.getTimeUntilExpiry();
        if (expiry && expiry.days <= 7) return 'expiring_soon';

        return 'active';
    }

    public isIpAllowed(ip: string): boolean {
        const allowedIps = this.allowedIps;
        if (!allowedIps || allowedIps.length === 0) return true;
        return allowedIps.includes(ip);
    }

    public toPublicJSON(): any {
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
    }

    // Static Methods
    static async findByPrefix(prefix: string): Promise<ApiKey | null> {
        return this.findOne({ where: { prefix } });
    }

    static async findActiveByTenant(tenantId: string): Promise<ApiKey[]> {
        return this.findAll({
            where: {
                tenantId,
                isActive: true,
                isRevoked: false
            }
        });
    }

    static async countActiveByTenant(tenantId: string): Promise<number> {
        return this.count({
            where: {
                tenantId,
                isActive: true,
                isRevoked: false
            }
        });
    }
}

ApiKey.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    tenantId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'tenant_id',
    },
    keyHash: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'key_hash'
    },
    prefix: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    rateLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 1000,
        field: 'rate_limit'
    },
    scopes: {
        type: DataTypes.JSON,
        defaultValue: ['read'],
        get() {
            const value = this.getDataValue('scopes');
            return value || [];
        }
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'expires_at'
    },
    lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at'
    },
    usageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'usage_count'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active'
    },
    isRevoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_revoked'
    },
    revokedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'revoked_at'
    },
    revokedReason: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 'revoked_reason'
    },
    createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'created_by'
    },
    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        get() {
            const value = this.getDataValue('metadata');
            return value || {};
        }
    },
    allowedIps: {
        type: DataTypes.JSON,
        defaultValue: null,
        field: 'allowed_ips',
        get() {
            const value = this.getDataValue('allowedIps');
            return value || null;
        }
    },
    environment: {
        type: DataTypes.ENUM('live', 'test'),
        defaultValue: 'live'
    }
}, {
    sequelize,
    tableName: 'api_keys',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['prefix'], unique: true },
        { fields: ['tenant_id', 'is_revoked'] },
        { fields: ['tenant_id', 'is_active'] },
        { fields: ['expires_at'] },
        { fields: ['last_used_at'] },
        { fields: ['created_by'] }
    ]
});
