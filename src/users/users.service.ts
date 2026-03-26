import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService implements OnModuleInit {
    private readonly logger = new Logger(UsersService.name);

    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        this.logger.log('Checking/Upserting default ADMIN user...');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await this.prisma.user.upsert({
            where: { email: 'admin@admin.com' },
            update: {
                password: hashedPassword,
                role: 'ADMIN',
                name: 'Administrador Principal'
            },
            create: {
                name: 'Administrador Principal',
                email: 'admin@admin.com',
                password: hashedPassword,
                role: 'ADMIN',
            }
        });
        this.logger.log('Default ADMIN ensured. Email: admin@admin.com | Password: admin123');
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
        });
    }

    async findOne(id: number) {
        return this.prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true }
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async create(data: any) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        return this.prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
            },
        });
    }

    async update(id: number, data: any) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.user.delete({
            where: { id },
        });
    }
}
