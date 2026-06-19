import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
    private readonly logger = new Logger(UsersService.name);

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        this.logger.log('Checking/Upserting default ADMIN user...');
        
        // Ensure ADMIN role exists or wait for it
        let adminRole = await this.prisma.role.findUnique({ where: { name: 'ADMIN' } });
        if (!adminRole) {
            this.logger.log('Creating default ADMIN role in service...');
            adminRole = await this.prisma.role.create({
                data: {
                    name: 'ADMIN',
                    description: 'Administrador con acceso completo a todos los recursos y configuraciones.',
                    permissions: {
                        vehicles: { create: true, read: true, update: true, delete: true },
                        users: { create: true, read: true, update: true, delete: true },
                        catalogs: { create: true, read: true, update: true, delete: true }
                    }
                }
            });
        }

        const hashedPassword = await bcrypt.hash('admin123', 10);
        await this.prisma.user.upsert({
            where: { email: 'admin@admin.com' },
            update: {
                password: hashedPassword,
                role: 'ADMIN',
                roleId: adminRole.id,
                name: 'Administrador Principal'
            },
            create: {
                name: 'Administrador Principal',
                email: 'admin@admin.com',
                password: hashedPassword,
                role: 'ADMIN',
                roleId: adminRole.id,
            }
        });
        this.logger.log('Default ADMIN ensured. Email: admin@admin.com | Password: admin123');
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: { 
                id: true, 
                name: true, 
                email: true, 
                role: true, 
                roleId: true,
                roleRel: {
                    select: {
                        id: true,
                        name: true,
                        permissions: true
                    }
                },
                allowedCedis: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdAt: true, 
                updatedAt: true 
            }
        });
    }

    async findOne(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            select: { 
                id: true, 
                name: true, 
                email: true, 
                role: true, 
                roleId: true,
                roleRel: {
                    select: {
                        id: true,
                        name: true,
                        permissions: true
                    }
                },
                allowedCedis: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                createdAt: true, 
                updatedAt: true 
            }
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
            include: {
                roleRel: true,
                allowedCedis: true
            }
        });
    }

    async create(data: any) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const { password, allowedCedis, ...userData } = data;
        
        // If roleId is passed, make sure we set the string role as the name of the role
        let roleName = data.role || 'OPERATOR';
        if (data.roleId) {
            const roleObj = await this.prisma.role.findUnique({ where: { id: Number(data.roleId) } });
            if (roleObj) {
                roleName = roleObj.name;
            }
        }

        return this.prisma.user.create({
            data: {
                ...userData,
                role: roleName,
                roleId: data.roleId ? Number(data.roleId) : null,
                password: hashedPassword,
                allowedCedis: allowedCedis && Array.isArray(allowedCedis) ? {
                    connect: allowedCedis.map((id: number) => ({ id }))
                } : undefined
            },
            include: {
                roleRel: true,
                allowedCedis: true
            }
        });
    }

    async update(id: number, data: any) {
        const { allowedCedis, ...updateData } = data;
        if (data.password) {
            updateData.password = await bcrypt.hash(data.password, 10);
        }
        if (data.roleId) {
            updateData.roleId = Number(data.roleId);
            const roleObj = await this.prisma.role.findUnique({ where: { id: updateData.roleId } });
            if (roleObj) {
                updateData.role = roleObj.name;
            }
        }
        return this.prisma.user.update({
            where: { id },
            data: {
                ...updateData,
                allowedCedis: allowedCedis && Array.isArray(allowedCedis) ? {
                    set: allowedCedis.map((id: number) => ({ id }))
                } : undefined
            },
            include: {
                roleRel: true,
                allowedCedis: true
            }
        });
    }

    async remove(id: number) {
        return this.prisma.user.delete({
            where: { id },
        });
    }
}

