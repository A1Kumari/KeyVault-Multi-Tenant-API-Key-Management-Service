const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const UsageLog = sequelize.define('UsageLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    status: {
        type: DataTypes.INTEGER, // HTTP status code e.g. 200, 429
        allowNull: false,
    },
    endpoint: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    ip: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    timestamps: false, // We'll handle our own timestamp
    tableName: 'usage_logs',
    indexes: [
        {
            fields: ['timestamp'],
        }
    ]
});

module.exports = UsageLog;
