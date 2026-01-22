import { Request, Response } from 'express';
import { authService } from '../services/auth.service';

class AuthController {
    async register(req: Request, res: Response) {
        try {
            const { name, email, password } = req.body;
            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Name, email and password are required' });
            }
            const token = await authService.register({ name, email, password });
            res.status(201).json({ token });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }
            const token = await authService.login({ email, password });
            res.status(200).json({ token });
        } catch (error: any) {
            res.status(401).json({ error: error.message });
        }
    }

    // Refresh token implementation (placeholder if not in service yet, but route exists)
    async refreshToken(req: Request, res: Response) {
        try {
            // TODO: Implement refresh token logic in service
            res.status(501).json({ error: 'Not implemented' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async forgotPassword(req: Request, res: Response) {
        try {
            // TODO: Implement logic
            res.status(501).json({ error: 'Not implemented' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async resetPassword(req: Request, res: Response) {
        try {
            // TODO: Implement logic
            res.status(501).json({ error: 'Not implemented' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    async getMe(req: any, res: Response) {
        try {
            const tenant = await authService.getProfile(req.user.id);
            res.json(tenant);
        } catch (error: any) {
            res.status(404).json({ error: error.message });
        }
    }

    async logout(req: Request, res: Response) {
        res.json({ message: 'Logged out successfully' });
    }

    async changePassword(req: Request, res: Response) {
        res.status(501).json({ error: 'Not implemented' });
    }
}

export const authController = new AuthController();
