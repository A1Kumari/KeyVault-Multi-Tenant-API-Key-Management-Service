// src/modules/secrets/secrets.service.ts

import { prisma } from '@/config/database';
import { encryptionService, EncryptedData } from '../encryption/encryption.service';
import { auditService } from './audit.service';
import { ForbiddenError, NotFoundError, ConflictError } from '@/shared/errors';

export interface CreateSecretInput {
    key: string;
    value: string;
    path?: string;
    description?: string;
    tags?: string[];
}

export interface UpdateSecretInput {
    value?: string;
    description?: string;
    tags?: string[];
}

export interface SecretResponse {
    id: string;
    key: string;
    value?: string;  // Only included if decrypted
    path: string;
    version: number;
    description?: string;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    createdBy?: {
        id: string;
        email: string;
    };
}

export interface ListSecretsOptions {
    includeValues?: boolean;
    path?: string;
    tags?: string[];
    search?: string;
    page?: number;
    limit?: number;
}

class SecretsService {

    /**
     * Create a new secret
     */
    async createSecret(
        environmentId: string,
        input: CreateSecretInput,
        userId: string,
        orgId: string
    ): Promise<SecretResponse> {
        const { key, value, path = '/', description, tags = [] } = input;

        // Check for existing secret
        const existing = await prisma.secret.findUnique({
            where: {
                environmentId_path_key: { environmentId, path, key }
            }
        });

        if (existing && !existing.deletedAt) {
            throw new ConflictError(`Secret "${key}" already exists at path "${path}"`);
        }

        // Get organization's KEK
        const org = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { encryptedKek: true, kekVersion: true }
        });

        if (!org) throw new NotFoundError('Organization not found');

        const kek = await encryptionService.decryptOrgKEK(org.encryptedKek);

        // Encrypt the secret value
        const encryptedData = await encryptionService.encryptSecret(
            value,
            kek,
            org.kekVersion
        );

        // Create blind index for searching
        const keyHash = await encryptionService.createBlindIndex(key, orgId);

        // Create secret with first version
        const secret = await prisma.$transaction(async (tx) => {
            const secret = await tx.secret.create({
                data: {
                    key,
                    keyHash,
                    path,
                    description,
                    tags,
                    environmentId,
                    currentVersion: 1,
                    versions: {
                        create: {
                            version: 1,
                            encryptedValue: encryptedData.ciphertext,
                            encryptedDek: encryptedData.encryptedDek,
                            iv: encryptedData.iv,
                            authTag: encryptedData.authTag,
                            algorithm: encryptedData.algorithm,
                            kekVersion: encryptedData.keyVersion,
                            createdById: userId
                        }
                    }
                },
                include: {
                    versions: {
                        where: { version: 1 },
                        include: {
                            createdBy: {
                                select: { id: true, email: true }
                            }
                        }
                    }
                }
            });

            // Update currentVersionId
            await tx.secret.update({
                where: { id: secret.id },
                data: { currentVersionId: secret.versions[0].id }
            });

            return secret;
        });

        // Wipe KEK from memory
        kek.fill(0);

        // Audit log
        await auditService.log({
            organizationId: orgId,
            actorId: userId,
            action: 'secret.create',
            resourceType: 'secret',
            resourceId: secret.id,
            resourceName: key,
            metadata: { path, environment: environmentId }
        });

        return {
            id: secret.id,
            key: secret.key,
            path: secret.path,
            version: secret.currentVersion,
            description: secret.description || undefined,
            tags: secret.tags,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            createdBy: secret.versions[0].createdBy || undefined
        };
    }

    /**
     * Get a secret by key
     */
    async getSecret(
        environmentId: string,
        key: string,
        path: string = '/',
        orgId: string,
        userId: string,
        includeValue: boolean = true
    ): Promise<SecretResponse> {
        const secret = await prisma.secret.findUnique({
            where: {
                environmentId_path_key: { environmentId, path, key },
                deletedAt: null
            },
            include: {
                versions: {
                    where: { version: { equals: prisma.secret.fields.currentVersion } },
                    take: 1,
                    include: {
                        createdBy: { select: { id: true, email: true } }
                    }
                }
            }
        });

        if (!secret) {
            throw new NotFoundError(`Secret "${key}" not found`);
        }

        let decryptedValue: string | undefined;

        if (includeValue) {
            const org = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { encryptedKek: true }
            });

            if (!org) throw new NotFoundError('Organization not found');

            const kek = await encryptionService.decryptOrgKEK(org.encryptedKek);
            const version = secret.versions[0];

            const result = await encryptionService.decryptSecret({
                ciphertext: version.encryptedValue,
                iv: version.iv,
                authTag: version.authTag,
                encryptedDek: version.encryptedDek,
                algorithm: version.algorithm,
                keyVersion: version.kekVersion
            }, kek);

            decryptedValue = result.plaintext;
            kek.fill(0);

            // Audit secret access
            await auditService.log({
                organizationId: orgId,
                actorId: userId,
                action: 'secret.read',
                resourceType: 'secret',
                resourceId: secret.id,
                resourceName: key
            });
        }

        return {
            id: secret.id,
            key: secret.key,
            value: decryptedValue,
            path: secret.path,
            version: secret.currentVersion,
            description: secret.description || undefined,
            tags: secret.tags,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt,
            createdBy: secret.versions[0]?.createdBy || undefined
        };
    }

    /**
     * Update a secret (creates new version)
     */
    async updateSecret(
        environmentId: string,
        key: string,
        path: string = '/',
        input: UpdateSecretInput,
        userId: string,
        orgId: string
    ): Promise<SecretResponse> {
        const secret = await prisma.secret.findUnique({
            where: {
                environmentId_path_key: { environmentId, path, key },
                deletedAt: null
            }
        });

        if (!secret) {
            throw new NotFoundError(`Secret "${key}" not found`);
        }

        const { value, description, tags } = input;
        const updates: any = {};

        if (description !== undefined) updates.description = description;
        if (tags !== undefined) updates.tags = tags;

        // If value is being updated, create new version
        if (value !== undefined) {
            const org = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { encryptedKek: true, kekVersion: true }
            });

            if (!org) throw new NotFoundError('Organization not found');

            const kek = await encryptionService.decryptOrgKEK(org.encryptedKek);
            const encryptedData = await encryptionService.encryptSecret(
                value,
                kek,
                org.kekVersion
            );

            const newVersion = secret.currentVersion + 1;

            const updatedSecret = await prisma.$transaction(async (tx) => {
                // Create new version
                const version = await tx.secretVersion.create({
                    data: {
                        secretId: secret.id,
                        version: newVersion,
                        encryptedValue: encryptedData.ciphertext,
                        encryptedDek: encryptedData.encryptedDek,
                        iv: encryptedData.iv,
                        authTag: encryptedData.authTag,
                        algorithm: encryptedData.algorithm,
                        kekVersion: encryptedData.keyVersion,
                        createdById: userId
                    }
                });

                // Update secret
                return tx.secret.update({
                    where: { id: secret.id },
                    data: {
                        ...updates,
                        currentVersion: newVersion,
                        currentVersionId: version.id,
                        updatedAt: new Date()
                    }
                });
            });

            kek.fill(0);

            await auditService.log({
                organizationId: orgId,
                actorId: userId,
                action: 'secret.update',
                resourceType: 'secret',
                resourceId: secret.id,
                resourceName: key,
                metadata: { newVersion }
            });

            return {
                id: updatedSecret.id,
                key: updatedSecret.key,
                path: updatedSecret.path,
                version: updatedSecret.currentVersion,
                description: updatedSecret.description || undefined,
                tags: updatedSecret.tags,
                createdAt: updatedSecret.createdAt,
                updatedAt: updatedSecret.updatedAt
            };
        }

        // Just metadata update
        const updatedSecret = await prisma.secret.update({
            where: { id: secret.id },
            data: { ...updates, updatedAt: new Date() }
        });

        return {
            id: updatedSecret.id,
            key: updatedSecret.key,
            path: updatedSecret.path,
            version: updatedSecret.currentVersion,
            description: updatedSecret.description || undefined,
            tags: updatedSecret.tags,
            createdAt: updatedSecret.createdAt,
            updatedAt: updatedSecret.updatedAt
        };
    }

    /**
     * List secrets in an environment
     */
    async listSecrets(
        environmentId: string,
        orgId: string,
        userId: string,
        options: ListSecretsOptions = {}
    ): Promise<{ secrets: SecretResponse[]; total: number }> {
        const {
            includeValues = false,
            path,
            tags,
            search,
            page = 1,
            limit = 50
        } = options;

        const where: any = {
            environmentId,
            deletedAt: null
        };

        if (path) where.path = path;
        if (tags?.length) where.tags = { hasSome: tags };
        if (search) where.key = { contains: search, mode: 'insensitive' };

        const [secrets, total] = await Promise.all([
            prisma.secret.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ path: 'asc' }, { key: 'asc' }],
                include: {
                    versions: {
                        where: { version: { equals: prisma.secret.fields.currentVersion } },
                        take: 1
                    }
                }
            }),
            prisma.secret.count({ where })
        ]);

        let kek: Buffer | null = null;

        if (includeValues && secrets.length > 0) {
            const org = await prisma.organization.findUnique({
                where: { id: orgId },
                select: { encryptedKek: true }
            });

            if (org) {
                kek = await encryptionService.decryptOrgKEK(org.encryptedKek);
            }
        }

        const results = await Promise.all(
            secrets.map(async (secret) => {
                let value: string | undefined;

                if (includeValues && kek && secret.versions[0]) {
                    const version = secret.versions[0];
                    const result = await encryptionService.decryptSecret({
                        ciphertext: version.encryptedValue,
                        iv: version.iv,
                        authTag: version.authTag,
                        encryptedDek: version.encryptedDek,
                        algorithm: version.algorithm,
                        keyVersion: version.kekVersion
                    }, kek);
                    value = result.plaintext;
                }

                return {
                    id: secret.id,
                    key: secret.key,
                    value,
                    path: secret.path,
                    version: secret.currentVersion,
                    description: secret.description || undefined,
                    tags: secret.tags,
                    createdAt: secret.createdAt,
                    updatedAt: secret.updatedAt
                };
            })
        );

        if (kek) kek.fill(0);

        // Audit bulk read
        if (includeValues) {
            await auditService.log({
                organizationId: orgId,
                actorId: userId,
                action: 'secret.list_with_values',
                resourceType: 'environment',
                resourceId: environmentId,
                metadata: { count: secrets.length }
            });
        }

        return { secrets: results, total };
    }

    /**
     * Delete a secret (soft delete)
     */
    async deleteSecret(
        environmentId: string,
        key: string,
        path: string = '/',
        userId: string,
        orgId: string,
        permanent: boolean = false
    ): Promise<void> {
        const secret = await prisma.secret.findUnique({
            where: {
                environmentId_path_key: { environmentId, path, key }
            }
        });

        if (!secret) {
            throw new NotFoundError(`Secret "${key}" not found`);
        }

        if (permanent) {
            await prisma.secret.delete({
                where: { id: secret.id }
            });
        } else {
            await prisma.secret.update({
                where: { id: secret.id },
                data: { deletedAt: new Date() }
            });
        }

        await auditService.log({
            organizationId: orgId,
            actorId: userId,
            action: permanent ? 'secret.delete_permanent' : 'secret.delete',
            resourceType: 'secret',
            resourceId: secret.id,
            resourceName: key
        });
    }

    /**
     * Get secret versions history
     */
    async getSecretVersions(
        secretId: string,
        orgId: string
    ): Promise<Array<{
        version: number;
        createdAt: Date;
        createdBy?: { id: string; email: string };
    }>> {
        const versions = await prisma.secretVersion.findMany({
            where: { secretId },
            orderBy: { version: 'desc' },
            select: {
                version: true,
                createdAt: true,
                createdBy: {
                    select: { id: true, email: true }
                }
            }
        });

        return versions.map(v => ({
            version: v.version,
            createdAt: v.createdAt,
            createdBy: v.createdBy || undefined
        }));
    }

    /**
     * Rollback to a specific version
     */
    async rollbackToVersion(
        secretId: string,
        targetVersion: number,
        userId: string,
        orgId: string
    ): Promise<SecretResponse> {
        const [secret, targetVersionData] = await Promise.all([
            prisma.secret.findUnique({
                where: { id: secretId },
                include: { environment: true }
            }),
            prisma.secretVersion.findUnique({
                where: {
                    secretId_version: { secretId, version: targetVersion }
                }
            })
        ]);

        if (!secret || !targetVersionData) {
            throw new NotFoundError('Secret or version not found');
        }

        const newVersion = secret.currentVersion + 1;

        // Create new version with same encrypted data
        await prisma.$transaction(async (tx) => {
            const version = await tx.secretVersion.create({
                data: {
                    secretId,
                    version: newVersion,
                    encryptedValue: targetVersionData.encryptedValue,
                    encryptedDek: targetVersionData.encryptedDek,
                    iv: targetVersionData.iv,
                    authTag: targetVersionData.authTag,
                    algorithm: targetVersionData.algorithm,
                    kekVersion: targetVersionData.kekVersion,
                    createdById: userId
                }
            });

            await tx.secret.update({
                where: { id: secretId },
                data: {
                    currentVersion: newVersion,
                    currentVersionId: version.id,
                    updatedAt: new Date()
                }
            });
        });

        await auditService.log({
            organizationId: orgId,
            actorId: userId,
            action: 'secret.rollback',
            resourceType: 'secret',
            resourceId: secretId,
            resourceName: secret.key,
            metadata: { fromVersion: secret.currentVersion, toVersion: targetVersion, newVersion }
        });

        return {
            id: secret.id,
            key: secret.key,
            path: secret.path,
            version: newVersion,
            description: secret.description || undefined,
            tags: secret.tags,
            createdAt: secret.createdAt,
            updatedAt: new Date()
        };
    }
}

export const secretsService = new SecretsService();