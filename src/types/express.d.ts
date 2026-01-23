// src/types/express.d.ts

// Don't import anything - define the interface here
interface JwtPayload {
    userId: string;
    email: string;
    role: string;
    type: 'access' | 'refresh';
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            token?: string;
            requestId?: string;
        }
    }
}

// This is required to make it a module
export { };