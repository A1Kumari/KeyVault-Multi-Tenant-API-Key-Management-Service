import { Tenant } from '../models';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

class AuthService {
    async register({ name, email, password }: any) {
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

    async login({ email, password }: any) {
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

    async getProfile(id: string) {
        const tenant = await Tenant.findByPk(id, {
            attributes: { exclude: ['password'] }
        });
        if (!tenant) throw new Error('Tenant not found');
        return tenant;
    }

    generateToken(tenant: any) {
        const payload = {
            id: tenant.id,
            userId: tenant.id,
            email: tenant.email,
            tenantId: tenant.id,
        };
        const secret = process.env.JWT_SECRET || 'secret';
        return jwt.sign(payload, secret, { expiresIn: '1d' });
    }
}

export const authService = new AuthService();
