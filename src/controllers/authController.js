const tenantService = require('../services/tenantService');

class AuthController {
    async register(req, res) {
        try {
            const { name, email, password } = req.body;
            if (!email || !password || !name) {
                return res.status(400).json({ error: 'Name, email and password are required' });
            }
            const token = await tenantService.register({ name, email, password });
            res.status(201).json({ token });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }
            const token = await tenantService.login({ email, password });
            res.status(200).json({ token });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }

    async getMe(req, res) {
        try {
            const tenant = await tenantService.getProfile(req.user.id);
            res.json(tenant);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }
}

module.exports = new AuthController();
