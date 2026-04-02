import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product) throw new NotFoundException('El producto no existe');

        const stockCount = await this.prisma.inventoryStock.count({ where: { productId: id, quantity: { gt: 0 } } });
        const movementCount = await this.prisma.inventoryMovement.count({ where: { productId: id } });
        const maintPartCount = await this.prisma.maintenancePart.count({ where: { productId: id } });
        const exchangeCount = await this.prisma.partExchange.count({ where: { productId: id } });
        const ticketItemCount = await this.prisma.maintenanceTicketItem.count({ where: { productId: id } });

        if (stockCount > 0 || movementCount > 0 || maintPartCount > 0 || exchangeCount > 0 || ticketItemCount > 0) {
            const details: string[] = [];
            if (stockCount > 0) details.push(`existencias en inventario`);
            if (movementCount > 0) details.push(`${movementCount} movimientos de almacén`);
            if (maintPartCount > 0) details.push(`${maintPartCount} mantenimientos`);
            if (exchangeCount > 0) details.push(`${exchangeCount} intercambios de piezas`);
            if (ticketItemCount > 0) details.push(`${ticketItemCount} partidas de tickets`);

            throw new BadRequestException(`No se puede eliminar el producto "${product.name}" porque tiene: ${details.join(', ')}.`);
        }

        return this.prisma.product.delete({
            where: { id },
        });
    }
}
