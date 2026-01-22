const { sequelize } = require('../config/database');
const Tenant = require('./user.model');
const ApiKey = require('./apiKey.model');
const UsageLog = require('./usageLog.model');
const AuditLog = require('./auditLog.model');

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
console.log('   ├── ✅ Tenant -> ApiKeys');

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
console.log('   ├── ✅ ApiKey -> UsageLogs');

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
console.log('   ├── ✅ Tenant -> AuditLogs');

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
console.log('   ├── ✅ User -> AuditLogs (as actor)');

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
console.log('   └── ✅ User -> ApiKeys (as creator)');

// ===========================================
// Sync Database Function
// ===========================================

/**
 * Sync database schema with models
 * @param {Object} options - Sync options
 * @param {boolean} options.force - Drop tables and recreate (DANGEROUS!)
 * @param {boolean} options.alter - Alter existing tables to match models
 */
const syncDatabase = async (options = {}) => {
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

    } catch (error) {
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

/**
 * Check database connection
 * @returns {Promise<boolean>}
 */
const checkConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ [DATABASE] Connection verified');
        return true;
    } catch (error) {
        console.error('❌ [DATABASE] Connection failed:', error.message);
        return false;
    }
};

/**
 * Get database statistics
 * @returns {Promise<Object>}
 */
const getDatabaseStats = async () => {
    try {
        const [tenantCount] = await sequelize.query('SELECT COUNT(*) as count FROM tenants');
        const [keyCount] = await sequelize.query('SELECT COUNT(*) as count FROM api_keys');
        const [auditCount] = await sequelize.query('SELECT COUNT(*) as count FROM audit_logs');

        return {
            tenants: parseInt(tenantCount[0]?.count || 0),
            apiKeys: parseInt(keyCount[0]?.count || 0),
            auditLogs: parseInt(auditCount[0]?.count || 0)
        };
    } catch (error) {
        console.error('❌ [DATABASE] Failed to get stats:', error.message);
        return null;
    }
};

console.log('✅ [MODELS] All models and associations initialized\n');

module.exports = {
    sequelize,
    syncDatabase,
    checkConnection,
    getDatabaseStats,
    // Models
    Tenant,
    ApiKey,
    UsageLog,
    AuditLog
};