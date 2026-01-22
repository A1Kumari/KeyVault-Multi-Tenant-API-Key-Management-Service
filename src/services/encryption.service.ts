// src/modules/encryption/encryption.service.ts

import crypto from 'crypto';
import { promisify } from 'util';

const randomBytes = promisify(crypto.randomBytes);
const scrypt = promisify(crypto.scrypt) as (
    password: Buffer | string,
    salt: Buffer | string,
    keylen: number
) => Promise<Buffer>;

export interface EncryptedData {
    ciphertext: string;      // Base64 encoded
    iv: string;              // Base64 encoded
    authTag: string;         // Base64 encoded
    encryptedDek: string;    // Base64 encoded - DEK encrypted by KEK
    algorithm: string;
    keyVersion: number;
}

export interface DecryptedResult {
    plaintext: string;
    keyVersion: number;
}

export class EncryptionService {
    private readonly ALGORITHM = 'aes-256-gcm';
    private readonly IV_LENGTH = 16;
    private readonly AUTH_TAG_LENGTH = 16;
    private readonly DEK_LENGTH = 32; // 256 bits

    private masterKey: Buffer;

    constructor() {
        // In production, load from HSM, AWS KMS, or secure vault
        const masterKeyHex = process.env.MASTER_KEY;
        if (!masterKeyHex || masterKeyHex.length !== 64) {
            throw new Error('MASTER_KEY must be a 64-character hex string (256 bits)');
        }
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
    }

    /**
     * Generate a new Data Encryption Key (DEK)
     */
    async generateDEK(): Promise<Buffer> {
        return randomBytes(this.DEK_LENGTH);
    }

    /**
     * Encrypt DEK with organization's KEK (Key Encryption Key)
     */
    async encryptDEK(dek: Buffer, kek: Buffer): Promise<string> {
        const iv = await randomBytes(this.IV_LENGTH);
        const cipher = crypto.createCipheriv(this.ALGORITHM, kek, iv);

        const encrypted = Buffer.concat([
            cipher.update(dek),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:ciphertext (all base64)
        return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
    }

    /**
     * Decrypt DEK using organization's KEK
     */
    async decryptDEK(encryptedDek: string, kek: Buffer): Promise<Buffer> {
        const [ivB64, authTagB64, ciphertextB64] = encryptedDek.split(':');

        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');

        const decipher = crypto.createDecipheriv(this.ALGORITHM, kek, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);
    }

    /**
     * Encrypt a secret value (main encryption function)
     */
    async encryptSecret(
        plaintext: string,
        orgKek: Buffer,
        keyVersion: number = 1
    ): Promise<EncryptedData> {
        // Generate a unique DEK for this secret
        const dek = await this.generateDEK();

        // Encrypt the DEK with org's KEK
        const encryptedDek = await this.encryptDEK(dek, orgKek);

        // Encrypt the actual secret with the DEK
        const iv = await randomBytes(this.IV_LENGTH);
        const cipher = crypto.createCipheriv(this.ALGORITHM, dek, iv);

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        // Securely wipe DEK from memory
        dek.fill(0);

        return {
            ciphertext: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
            encryptedDek,
            algorithm: this.ALGORITHM,
            keyVersion
        };
    }

    /**
     * Decrypt a secret value
     */
    async decryptSecret(
        encryptedData: EncryptedData,
        orgKek: Buffer
    ): Promise<DecryptedResult> {
        // Decrypt the DEK first
        const dek = await this.decryptDEK(encryptedData.encryptedDek, orgKek);

        // Decrypt the secret
        const iv = Buffer.from(encryptedData.iv, 'base64');
        const authTag = Buffer.from(encryptedData.authTag, 'base64');
        const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');

        const decipher = crypto.createDecipheriv(this.ALGORITHM, dek, iv);
        decipher.setAuthTag(authTag);

        const plaintext = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]).toString('utf8');

        // Securely wipe DEK from memory
        dek.fill(0);

        return {
            plaintext,
            keyVersion: encryptedData.keyVersion
        };
    }

    /**
     * Generate organization KEK (called when creating new org)
     */
    async generateOrgKEK(): Promise<{ kek: Buffer; encryptedKek: string }> {
        const kek = await randomBytes(this.DEK_LENGTH);

        // Encrypt KEK with master key for storage
        const iv = await randomBytes(this.IV_LENGTH);
        const cipher = crypto.createCipheriv(this.ALGORITHM, this.masterKey, iv);

        const encrypted = Buffer.concat([
            cipher.update(kek),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        const encryptedKek = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

        return { kek, encryptedKek };
    }

    /**
     * Decrypt organization KEK (called when accessing org's secrets)
     */
    async decryptOrgKEK(encryptedKek: string): Promise<Buffer> {
        const [ivB64, authTagB64, ciphertextB64] = encryptedKek.split(':');

        const iv = Buffer.from(ivB64, 'base64');
        const authTag = Buffer.from(authTagB64, 'base64');
        const ciphertext = Buffer.from(ciphertextB64, 'base64');

        const decipher = crypto.createDecipheriv(this.ALGORITHM, this.masterKey, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);
    }

    /**
     * Rotate organization KEK (re-encrypt all secrets with new KEK)
     */
    async rotateOrgKEK(
        oldEncryptedKek: string,
        secrets: Array<{ id: string; encryptedDek: string }>
    ): Promise<{
        newEncryptedKek: string;
        updatedSecrets: Array<{ id: string; encryptedDek: string }>;
        newVersion: number;
    }> {
        // Decrypt old KEK
        const oldKek = await this.decryptOrgKEK(oldEncryptedKek);

        // Generate new KEK
        const { kek: newKek, encryptedKek: newEncryptedKek } = await this.generateOrgKEK();

        // Re-encrypt each secret's DEK with new KEK
        const updatedSecrets = await Promise.all(
            secrets.map(async (secret) => {
                const dek = await this.decryptDEK(secret.encryptedDek, oldKek);
                const newEncryptedDek = await this.encryptDEK(dek, newKek);
                dek.fill(0); // Wipe DEK

                return {
                    id: secret.id,
                    encryptedDek: newEncryptedDek
                };
            })
        );

        // Wipe keys from memory
        oldKek.fill(0);
        newKek.fill(0);

        return {
            newEncryptedKek,
            updatedSecrets,
            newVersion: Date.now() // Or increment from DB
        };
    }

    /**
     * Hash a secret key for blind indexing (searchable encryption)
     */
    async createBlindIndex(
        value: string,
        salt: string
    ): Promise<string> {
        const key = await scrypt(value, salt, 32);
        return key.toString('base64');
    }
}

export const encryptionService = new EncryptionService();