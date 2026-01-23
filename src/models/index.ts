import { sequelize } from '../config/database';
import { Tenant } from './user.model';
import { ApiKey } from './apiKey.model';
import { UsageLog } from './usageLog.model';
import { AuditLog } from './auditLog.model';

console.log('📦 [MODELS] Setting up model associations...');

// ===========================================
// Associations
// ===========================================

// Tenant -> ApiKeys (one-to-many)
Tenant.hasMany(ApiKey, {
    foreignKey: 'tenantId',
    as: 'apiKeys',
    onDelete: 'CASCADE'
});
ApiKey.belongsTo(Tenant, {
    foreignKey: 'tenantId',
    as: 'tenant'
});

// ApiKey -> UsageLogs (one-to-many)
ApiKey.hasMany(UsageLog, {
    foreignKey: 'keyId',
    as: 'logs',
    onDelete: 'CASCADE'
});
UsageLog.belongsTo(ApiKey, {
    foreignKey: 'keyId',
    as: 'apiKey'
});

// Tenant -> AuditLogs (one-to-many)
Tenant.hasMany(AuditLog, {
    foreignKey: 'tenantId',
    as: 'auditLogs',
    onDelete: 'CASCADE'
});
AuditLog.belongsTo(Tenant, {
    foreignKey: 'tenantId',
    as: 'tenant'
});

// Tenant (User) -> AuditLogs (as actor)
Tenant.hasMany(AuditLog, {
    foreignKey: 'userId',
    as: 'performedActions',
    onDelete: 'SET NULL'
});
AuditLog.belongsTo(Tenant, {
    foreignKey: 'userId',
    as: 'user'
});

// Tenant (User) -> ApiKeys (as creator)
Tenant.hasMany(ApiKey, {
    foreignKey: 'createdBy',
    as: 'createdKeys',
    onDelete: 'SET NULL'
});
ApiKey.belongsTo(Tenant, {
    foreignKey: 'createdBy',
    as: 'creator'
});

// ===========================================
// Sync Database Function
// ===========================================

interface SyncOptions {
    force?: boolean;
    alter?: boolean;
}

export const syncDatabase = async (options: SyncOptions = {}) => {
    const { force = false, alter = true } = options;

    console.log('🔄 [DATABASE] Syncing database...');
    console.log(`   ├── Force: ${force} ${force ? '⚠️ WILL DROP TABLES!' : ''}`);
    console.log(`   └── Alter: ${alter}`);

    try {
        // Sync in order of dependencies
        await sequelize.sync({ force, alter });

        console.log('✅ [DATABASE] Database synced successfully');

        // Log table info
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log(`📋 [DATABASE] Tables: ${tables.join(', ')}`);

    } catch (error: any) {
        console.error('❌ [DATABASE] Sync failed:', error.message);

        if (error.name === 'SequelizeDatabaseError') {
            console.error('💡 [HINT] Check your database connection and permissions');
        }

        throw error;
    }
};

// ===========================================
// Utility Functions
// ===========================================

export const checkConnection = async (): Promise<boolean> => {
    try {
        await sequelize.authenticate();
        console.log('✅ [DATABASE] Connection verified');
        return true;
    } catch (error: any) {
        console.error('❌ [DATABASE] Connection failed:', error.message);
        return false;
    }
};

export const getDatabaseStats = async (): Promise<{ tenants: number; apiKeys: number; auditLogs: number } | null> => {
    try {
        // Use count() method on models instead of raw query for better abstraction
        const tenantCount = await Tenant.count();
        const keyCount = await ApiKey.count();
        const auditCount = await AuditLog.count();

        return {
            tenants: tenantCount,
            apiKeys: keyCount,
            auditLogs: auditCount
        };
    } catch (error: any) {
        console.error('❌ [DATABASE] Failed to get stats:', error.message);
        return null;
    }
};

console.log('✅ [MODELS] All models and associations initialized\n');

export {
    sequelize,
    Tenant,
    ApiKey,
    UsageLog,
    AuditLog
};
