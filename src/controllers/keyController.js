const keyService = require('../services/keyService');
const { UsageLog } = require('../models');

class KeyController {
    async create(req, res) {
        try {
            const { name, rateLimit, scopes } = req.body;
            const result = await keyService.createKey(req.user.id, { name, rateLimit, scopes });
            res.status(201).json({
                success: true,
                data: result,
                message: '⚠️ Save this key now - it will NOT be shown again!'
            });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async list(req, res) {
        try {
            const keys = await keyService.listKeys(req.user.id);
            res.json({ success: true, data: keys });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async get(req, res) {
        try {
            const key = await keyService.getKey(req.user.id, req.params.id);
            res.json({ success: true, data: key });
        } catch (error) {
            res.status(404).json({ success: false, error: error.message });
        }
    }

    async update(req, res) {
        try {
            const key = await keyService.updateKey(req.user.id, req.params.id, req.body);
            res.json({ success: true, data: key });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async delete(req, res) {
        try {
            await keyService.deleteKey(req.user.id, req.params.id);
            res.json({ success: true, message: 'Key revoked' });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }

    async rotate(req, res) {
        try {
            const result = await keyService.rotateKey(req.user.id, req.params.id);
            res.json({
                success: true,
                data: result,
                message: 'New key created. Old key expires in 24 hours.'
            });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = new KeyController();
