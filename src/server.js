const app = require('./app');
const { sequelize, syncDatabase } = require('./models');
const redis = require('./config/redis');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        // Database connection
        await sequelize.authenticate();
        console.log('Database connected');

        // Sync models
        await syncDatabase();

        // Start server
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        process.exit(1);
    }
};

startServer();
