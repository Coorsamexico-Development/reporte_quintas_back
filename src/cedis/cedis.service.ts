import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CedisService {
    constructor(private prisma: PrismaService) { }

    async findAll(allowedCedis?: number[]) {
        return this.prisma.cedis.findMany({
            where: allowedCedis && allowedCedis.length > 0 ? {
                id: { in: allowedCedis.map(Number) }
            } : undefined,
            include: {
                _count: {
                    select: { currentVehicles: true },
                },
            },
        });
    }

    async findOne(id: number, allowedCedis?: number[]) {
        if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(id)) {
            return null;
        }
        return this.prisma.cedis.findUnique({
            where: { id },
            include: {
                currentVehicles: true,
                inventoryStock: {
                    include: { product: true },
                },
            },
        });
    }

    async create(data: { name: string; location?: string; latitude?: number; longitude?: number }) {
        return this.prisma.cedis.create({
            data,
        });
    }

    async update(id: number, data: { name?: string; location?: string; latitude?: number; longitude?: number }) {
        return this.prisma.cedis.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.cedis.delete({
            where: { id },
        });
    }
}
