const { Tenant } = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class TenantService {
    async register({ name, email, password }) {
        const existingTenant = await Tenant.findOne({ where: { email } });
        if (existingTenant) {
            throw new Error('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const tenant = await Tenant.create({
            name,
            email,
            password: hashedPassword,
        });

        return this.generateToken(tenant);
    }

    async login({ email, password }) {
        const tenant = await Tenant.findOne({ where: { email } });
        if (!tenant) {
            throw new Error('Invalid email or password');
        }

        const isValid = await bcrypt.compare(password, tenant.password);
        if (!isValid) {
            throw new Error('Invalid email or password');
        }

        return this.generateToken(tenant);
    }

    async getProfile(id) {
        const tenant = await Tenant.findByPk(id, {
            attributes: { exclude: ['password'] }
        });
        if (!tenant) throw new Error('Tenant not found');
        return tenant;
    }

    generateToken(tenant) {
        const payload = {
            id: tenant.id,
            email: tenant.email,
        };
        return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    }
}

module.exports = new TenantService();
