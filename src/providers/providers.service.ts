import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProvidersService {
    constructor(private prisma: PrismaService) { }

    async findAll(cedisId?: number) {
        return this.prisma.provider.findMany({
            where: cedisId ? { cedisId } : {},
            include: {
                cedis: true,
            },
        });
    }

    async findOne(id: number) {
        return this.prisma.provider.findUnique({
            where: { id },
            include: {
                maintenances: true,
            },
        });
    }

    async create(data: { name: string; contact?: string; services?: string }) {
        return this.prisma.provider.create({
            data,
        });
    }

    async update(id: number, data: { name?: string; contact?: string; services?: string }) {
        return this.prisma.provider.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.provider.delete({
            where: { id },
        });
    }
}
