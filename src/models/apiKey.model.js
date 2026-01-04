const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ApiKey = sequelize.define('ApiKey', {
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    keyHash: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    prefix: {
        type: DataTypes.STRING,
        allowNull: false,
        index: true, // For faster lookups
    },
    name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    rateLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 1000, // Requests per minute
    },
    scopes: {
        type: DataTypes.JSON, // Array of strings e.g. ["read", "write"]
        defaultValue: [],
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    }
}, {
    timestamps: true,
    tableName: 'api_keys'
});

module.exports = ApiKey;
