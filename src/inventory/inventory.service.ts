import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryStartType } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class InventoryService {
    constructor(
        private prisma: PrismaService,
        private storageService: StorageService
    ) { }

    async recordMovement(data: {
        cedisId: number;
        productId: number;
        type: InventoryStartType;
        quantity: number;
        unitPrice?: number;
        userId?: number;
        notes?: string;
    }, files?: Express.Multer.File[]) {
        // Determine sign based on type
        const isIncreasing = ([
            InventoryStartType.PURCHASE,
            InventoryStartType.TRANSFER_IN,
            InventoryStartType.ADJUSTMENT,
        ] as InventoryStartType[]).includes(data.type);

        const quantityChange = isIncreasing ? data.quantity : -data.quantity;

        return this.prisma.$transaction(async (tx) => {
            // 1. Record the movement history
            const movement = await tx.inventoryMovement.create({
                data: {
                    cedisId: data.cedisId,
                    productId: data.productId,
                    type: data.type,
                    quantity: data.quantity,
                    unitPrice: data.unitPrice,
                    totalCost: data.unitPrice ? data.unitPrice * data.quantity : null,
                    userId: data.userId,
                    notes: data.notes,
                },
            });

            // 1.5 Upload evidence if provided
            if (files && files.length > 0) {
                const uploadPromises = files.map(file => this.storageService.uploadFile(file, 'inventory_evidences'));
                const uploadResults = await Promise.all(uploadPromises);

                const validUrls = uploadResults.filter(Boolean);
                if (validUrls.length > 0) {
                    await tx.inventoryMovementEvidence.createMany({
                        data: validUrls.map(url => ({
                            movementId: movement.id,
                            url: url,
                        })),
                    });
                }
            }

            // 2. Update the local stock at that CEDIS
            const stock = await tx.inventoryStock.upsert({
                where: {
                    cedisId_productId: {
                        cedisId: data.cedisId,
                        productId: data.productId,
                    },
                },
                update: {
                    quantity: { increment: quantityChange },
                },
                create: {
                    cedisId: data.cedisId,
                    productId: data.productId,
                    quantity: quantityChange < 0 ? 0 : quantityChange, // Don't start with negative
                },
            });

            if (stock.quantity < 0) {
                throw new BadRequestException('Insufficient stock for this operation');
            }

            return { movement, stock };
        });
    }

    async getMovements(cedisId?: number, productId?: number) {
        return this.prisma.inventoryMovement.findMany({
            where: {
                cedisId: cedisId ? +cedisId : undefined,
                productId: productId ? +productId : undefined,
            },
            include: {
                product: true,
                cedis: true,
                user: true,
                evidence: true,
            },
            orderBy: { date: 'desc' },
        });
    }

    async getStock(cedisId?: number) {
        return this.prisma.inventoryStock.findMany({
            where: {
                cedisId: cedisId ? +cedisId : undefined,
            },
            include: {
                product: true,
                cedis: true,
            },
        });
    }
}
