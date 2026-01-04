const { ApiKey, UsageLog } = require('../models');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

class KeyService {
  generateKey() {
    // Generate a secure random string
    const randomBytes = crypto.randomBytes(24).toString('hex'); // 48 chars
    return `kv_live_ ${randomBytes}`;
  }

  async createKey(tenantId, { name, rateLimit, scopes }) {
    const rawKey = this.generateKey();
    // Hash the key using bcrypt
    const keyHash = await bcrypt.hash(rawKey, 10);
    // Store only the first 8 chars of the random part + prefix as "prefix" for efficient lookup
    // Format: kv_live_abc123...
    // Prefix stored: kv_live_abc1
    const prefix = rawKey.substring(0, 12); // kv_live_ + 4 chars

    const newKey = await ApiKey.create({
      tenantId,
      keyHash,
      prefix,
      name,
      rateLimit: rateLimit || 1000,
      scopes: scopes || [],
    });

    return {
      ...newKey.toJSON(),
      key: rawKey // Return raw key ONLY once
    };
  }

  async listKeys(tenantId) {
    return ApiKey.findAll({
      where: { tenantId, isActive: true },
      attributes: { exclude: ['keyHash'] },
      order: [['createdAt', 'DESC']]
    });
  }

  async getKey(tenantId, keyId) {
    const key = await ApiKey.findOne({
      where: { id: keyId, tenantId },
      attributes: { exclude: ['keyHash'] }
    });
    if (!key) throw new Error('Key not found');
    return key;
  }

  async updateKey(tenantId, keyId, updates) {
    const key = await this.getKey(tenantId, keyId);
    return key.update(updates);
  }

  async deleteKey(tenantId, keyId) {
    const key = await this.getKey(tenantId, keyId);
    return key.update({ isActive: false }); // Soft delete
  }

  async rotateKey(tenantId, keyId) {
    const oldKey = await this.getKey(tenantId, keyId);

    // Create new key with same settings
    const newKeyResult = await this.createKey(tenantId, {
      name: oldKey.name,
      rateLimit: oldKey.rateLimit,
      scopes: oldKey.scopes
    });

    // Schedule old key expiration (e.g. 24 hours from now)
    // For simplicity, we'll just keep it active and user deletes it, 
    // OR we could set expiresAt. The prompt mentioned "Grace period", let's set expiresAt.
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await oldKey.update({ expiresAt });

    return newKeyResult;
  }

  // Used by external verification endpoint
  async verifyKey(rawKey) {
    if (!rawKey.startsWith('kv_live_')) {
      return { valid: false, error: 'Invalid key format' };
    }

    // Lookup by prefix (kv_live_ + 4 chars) to narrow down candidates
    const prefix = rawKey.substring(0, 12);

    // Fetch all candidates with this prefix (should be very few, usually 1)
    // We need to check isActive and expiration
    const candidates = await ApiKey.findAll({
      where: {
        prefix,
        isActive: true,
        [Op.or]: [
          { expiresAt: null }, // No expiry
          { expiresAt: { [Op.gt]: new Date() } } // Expiry in future
        ]
      }
    });

    for (const candidate of candidates) {
      const isValid = await bcrypt.compare(rawKey, candidate.keyHash);
      if (isValid) {
        // Update lastUsed (async, fire and forget or await if critical)
        // await candidate.update({ lastUsedAt: new Date() }); // If we added lastUsedAt column

        return {
          valid: true,
          key: candidate
        };
      }
    }

    return { valid: false, error: 'Invalid key' };
  }
}

module.exports = new KeyService();
