// src/types/express.d.ts

import { JwtPayload } from './index';

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            requestId?: string;
            startTime?: number;
        }
    }
}

export { };