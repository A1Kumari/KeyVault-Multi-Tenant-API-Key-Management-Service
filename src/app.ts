import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import { sendError } from './utils/response.utils';
import { rateLimiter } from './middleware/rateLimiter.middleware';

export const createApp = (): Application => {
    const app = express();

    // Security middleware
    app.use(helmet());
    app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
    }));

    // Body parsing
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    app.use(rateLimiter());

    // Health check
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // API routes
    app.use('/api/v1', routes);

    // 404 handler
    app.use((req: Request, res: Response) => {
        sendError(res, 404, 'Route not found');
    });

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        console.error('Error:', err);
        sendError(res, 500, process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message);
    });

    return app;
};

export default createApp;