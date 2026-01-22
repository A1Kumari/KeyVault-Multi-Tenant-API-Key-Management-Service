import { Request, Response } from 'express';
import { keyService } from '../services/key.service';

class KeyController {
    async create(req: any, res: Response) {
        try {
            const { name, rateLimit, scopes } = req.body;
            // req.user added by middleware
            const result = await keyService.createKey({
                tenantId: req.user.tenantId || req.user.userId, // fallback
                userId: req.user.userId,
                name,
                rateLimit,
                scopes
            });
            res.status(201).json({
                success: true,
                data: result,
                message: '⚠️ Save this key now - it will NOT be shown again!'
            });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async list(req: any, res: Response) {
        try {
            const keys = await keyService.listKeys(req.user.tenantId || req.user.userId);
            res.json({ success: true, data: keys });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async get(req: any, res: Response) {
        try {
            const key = await keyService.getKey(req.user.tenantId || req.user.userId, req.params.id);
            res.json({ success: true, data: key });
        } catch (error: any) {
            res.status(404).json({ success: false, error: error.message });
        }
    }

    async update(req: any, res: Response) {
        try {
            const key = await keyService.updateKey(req.user.tenantId || req.user.userId, req.params.id, req.body);
            res.json({ success: true, data: key });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async delete(req: any, res: Response) {
        try {
            await keyService.deleteKey(req.user.tenantId || req.user.userId, req.params.id);
            res.json({ success: true, message: 'Key revoked' });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async rotate(req: any, res: Response) {
        try {
            const result = await keyService.rotateKey(req.params.id, req.user.tenantId || req.user.userId, req.user.userId);
            res.json({
                success: true,
                data: result,
                message: 'New key created. Old key expires in 24 hours.'
            });
        } catch (error: any) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}

export const keyController = new KeyController();
