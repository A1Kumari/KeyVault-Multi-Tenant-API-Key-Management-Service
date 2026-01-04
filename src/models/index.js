const { sequelize } = require('../config/database');
const Tenant = require('./user.model');
const ApiKey = require('./apiKey.model');
const UsageLog = require('./usageLog.model');

// Associations
Tenant.hasMany(ApiKey, { foreignKey: 'tenantId', as: 'apiKeys' });
ApiKey.belongsTo(Tenant, { foreignKey: 'tenantId', as: 'tenant' });

ApiKey.hasMany(UsageLog, { foreignKey: 'keyId', as: 'logs' });
UsageLog.belongsTo(ApiKey, { foreignKey: 'keyId', as: 'apiKey' });

// Sync database function (be careful with force: true in prod)
const syncDatabase = async () => {
    try {
        await sequelize.sync({ alter: true }); // Updates schema to match model
        console.log('Database synced successfully');
    } catch (error) {
        console.error('Database sync failed:', error);
    }
};

module.exports = {
    sequelize,
    syncDatabase,
    Tenant,
    ApiKey,
    UsageLog
};
