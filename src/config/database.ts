import { Sequelize } from 'sequelize';
import { env } from './env';

export const sequelize = new Sequelize(
    env.DB_NAME,
    env.DB_USER,
    env.DB_PASSWORD,
    {
        host: env.DB_HOST,
        port: parseInt(env.DB_PORT, 10),
        dialect: 'postgres',
        logging: env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true, // Use snake_case in DB
        }
    }
);

export const connectDatabase = async (): Promise<void> => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
    } catch (error) {
        console.error('❌ Database connection failed:', error);
        process.exit(1);
    }
};

export const syncDatabase = async (): Promise<void> => {
    try {
        // In production, use migrations instead of sync
        if (env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ Database synced');
        }
    } catch (error) {
        console.error('❌ Database sync failed:', error);
        throw error;
    }
};

export const closeDatabase = async (): Promise<void> => {
    await sequelize.close();
    console.log('Database connection closed');
};