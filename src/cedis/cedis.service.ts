import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CedisService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.cedis.findMany({
            include: {
                _count: {
                    select: { currentVehicles: true },
                },
            },
        });
    }

    async findOne(id: number) {
        return this.prisma.cedis.findUnique({
            where: { id },
            include: {
                currentVehicles: true,
            },
        });
    }

    async create(data: { name: string; client?: string; location?: string; latitude?: number; longitude?: number }) {
        return this.prisma.cedis.create({
            data,
        });
    }

    async update(id: number, data: { name?: string; client?: string; location?: string; latitude?: number; longitude?: number }) {
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
