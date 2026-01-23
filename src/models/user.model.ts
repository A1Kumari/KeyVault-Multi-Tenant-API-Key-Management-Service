import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

// User attributes interface
interface UserAttributes {
    id: string;
    email: string;
    password: string;
    name: string | null;
    role: 'user' | 'admin';
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// Attributes for creating a new user (optional fields)
interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'name' | 'role' | 'isActive' | 'lastLoginAt' | 'createdAt' | 'updatedAt'> { }

// User model class
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public id!: string;
    public email!: string;
    public password!: string;
    public name!: string | null;
    public role!: 'user' | 'admin';
    public isActive!: boolean;
    public lastLoginAt!: Date | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Instance method to check password
    async comparePassword(candidatePassword: string): Promise<boolean> {
        return bcrypt.compare(candidatePassword, this.password);
    }

    // Return user data without sensitive fields
    toJSON(): Omit<UserAttributes, 'password'> {
        const values = { ...this.get() };
        delete (values as any).password;
        return values as Omit<UserAttributes, 'password'>;
    }
}

User.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        role: {
            type: DataTypes.ENUM('user', 'admin'),
            defaultValue: 'user',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active',
        },
        lastLoginAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_login_at',
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at',
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at',
        },
    },
    {
        sequelize,
        tableName: 'users',
        timestamps: true,
        underscored: true,
        hooks: {
            // Hash password before saving
            beforeCreate: async (user: User) => {
                if (user.password) {
                    user.password = await bcrypt.hash(user.password, env.BCRYPT_SALT_ROUNDS);
                }
            },
            beforeUpdate: async (user: User) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, env.BCRYPT_SALT_ROUNDS);
                }
            },
        },
    }
);

export default User;