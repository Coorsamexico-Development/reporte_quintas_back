import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.product.findMany();
    }

    async findOne(id: number) {
        return this.prisma.product.findUnique({
            where: { id },
            include: {
                stock: {
                    include: { cedis: true },
                },
            },
        });
    }

    async create(data: { name: string; code: string; description?: string; category: string }) {
        return this.prisma.product.create({
            data,
        });
    }

    async update(id: number, data: { name?: string; code?: string; description?: string; category?: string }) {
        return this.prisma.product.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.product.delete({
            where: { id },
        });
    }
}
