import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            }
        });
    }

    async findOne(id: number) {
        return this.prisma.role.findUnique({
            where: { id }
        });
    }

    async create(data: { name: string; description?: string; permissions: any }) {
        return this.prisma.role.create({
            data
        });
    }

    async update(id: number, data: { name?: string; description?: string; permissions?: any }) {
        return this.prisma.role.update({
            where: { id },
            data
        });
    }

    async remove(id: number) {
        // Prevent deleting ADMIN role
        const role = await this.prisma.role.findUnique({ where: { id } });
        if (role?.name === 'ADMIN') {
            throw new Error('No se puede eliminar el rol de Administrador.');
        }
        return this.prisma.role.delete({
            where: { id }
        });
    }
}
