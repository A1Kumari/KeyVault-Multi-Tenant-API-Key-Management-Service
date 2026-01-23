import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export class UsageLog extends Model {
    declare id: string;
    declare status: number;
    declare endpoint: string | null;
    declare ip: string | null;
    declare userAgent: string | null;
    declare timestamp: Date;
    declare keyId: string;
}

UsageLog.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: () => uuidv4(),
        primaryKey: true,
    },
    status: {
        type: DataTypes.INTEGER,
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
    sequelize,
    timestamps: false,
    tableName: 'usage_logs',
    indexes: [
        {
            fields: ['timestamp'],
        }
    ]
});
