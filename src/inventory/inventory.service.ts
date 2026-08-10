import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
        movementTypeId: number;
        quantity: number;
        unitPrice?: number;
        userId?: number;
        notes?: string;
    }, files?: Express.Multer.File[]) {
        // El signo (entrada/salida) lo define la categoria del tipo elegido,
        // no un listado hardcodeado de tipos.
        const movementType = await this.prisma.inventoryMovementType.findUnique({
            where: { id: data.movementTypeId },
            include: { category: true },
        });
        if (!movementType) {
            throw new BadRequestException('Tipo de movimiento inválido');
        }

        const isIncreasing = movementType.category.sign > 0;
        const quantityChange = isIncreasing ? data.quantity : -data.quantity;

        return this.prisma.$transaction(async (tx) => {
            // 1. Record the movement history
            const movement = await tx.inventoryMovement.create({
                data: {
                    cedisId: data.cedisId,
                    productId: data.productId,
                    movementTypeId: data.movementTypeId,
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

    async adjustMovement(movementId: number, data: {
        newQuantity: number;
        newUnitPrice?: number;
        reason: string;
        userId: number;
    }, allowedCedis?: number[]) {
        if (data.newQuantity < 0) {
            throw new BadRequestException('Quantity cannot be negative');
        }

        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.inventoryMovement.findUnique({
                where: { id: movementId },
                include: { movementType: { include: { category: true } } },
            });

            if (!movement) {
                throw new BadRequestException('Movement not found');
            }

            if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(movement.cedisId)) {
                throw new ForbiddenException('No tienes acceso a este CEDIS');
            }

            const oldQuantity = movement.quantity;
            const oldUnitPrice = movement.unitPrice ? Number(movement.unitPrice) : null;
            const newUnitPrice = data.newUnitPrice !== undefined ? data.newUnitPrice : oldUnitPrice;

            const sign = movement.movementType.category.sign > 0 ? 1 : -1;
            const deltaQuantity = (data.newQuantity - oldQuantity) * sign;

            const adjustment = await tx.inventoryMovementAdjustment.create({
                data: {
                    inventoryMovementId: movementId,
                    previousQuantity: oldQuantity,
                    newQuantity: data.newQuantity,
                    previousUnitPrice: oldUnitPrice,
                    newUnitPrice: newUnitPrice,
                    reason: data.reason,
                    userId: data.userId,
                },
            });

            await tx.inventoryMovement.update({
                where: { id: movementId },
                data: {
                    quantity: data.newQuantity,
                    unitPrice: newUnitPrice,
                    totalCost: newUnitPrice ? newUnitPrice * data.newQuantity : null,
                },
            });

            const stock = await tx.inventoryStock.upsert({
                where: {
                    cedisId_productId: {
                        cedisId: movement.cedisId,
                        productId: movement.productId,
                    },
                },
                update: {
                    quantity: { increment: deltaQuantity },
                },
                create: {
                    cedisId: movement.cedisId,
                    productId: movement.productId,
                    quantity: deltaQuantity < 0 ? 0 : deltaQuantity,
                },
            });

            if (stock.quantity < 0) {
                throw new BadRequestException('Insufficient stock for this adjustment');
            }

            return { adjustment, stock };
        });
    }

    async deactivateMovement(movementId: number, deleteReason: string, userId: number, allowedCedis?: number[]) {
        if (!deleteReason) {
            throw new BadRequestException('Se requiere una justificación para eliminar el movimiento');
        }

        return this.prisma.$transaction(async (tx) => {
            const movement = await tx.inventoryMovement.findUnique({
                where: { id: movementId },
                include: { movementType: { include: { category: true } } },
            });

            if (!movement) {
                throw new BadRequestException('Movimiento no encontrado');
            }

            if (!movement.isActive) {
                throw new BadRequestException('El movimiento ya se encuentra eliminado');
            }

            if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(movement.cedisId)) {
                throw new ForbiddenException('No tienes acceso a este CEDIS');
            }

            const isIncreasing = movement.movementType.category.sign > 0;
            const deltaQuantity = isIncreasing ? -movement.quantity : movement.quantity;

            const updatedMovement = await tx.inventoryMovement.update({
                where: { id: movementId },
                data: {
                    isActive: false,
                    deleteReason,
                    deletedBy: userId,
                },
            });

            const stock = await tx.inventoryStock.upsert({
                where: {
                    cedisId_productId: {
                        cedisId: movement.cedisId,
                        productId: movement.productId,
                    },
                },
                update: {
                    quantity: { increment: deltaQuantity },
                },
                create: {
                    cedisId: movement.cedisId,
                    productId: movement.productId,
                    quantity: deltaQuantity < 0 ? 0 : deltaQuantity,
                },
            });

            if (stock.quantity < 0) {
                throw new BadRequestException('No se puede eliminar este movimiento porque causaría un stock negativo en el inventario');
            }

            return { movement: updatedMovement, stock };
        });
    }

    async getMovements(cedisId?: number, productId?: number, allowedCedis?: number[]) {
        let whereCedis: any = undefined;
        if (allowedCedis && allowedCedis.length > 0) {
            if (cedisId) {
                if (allowedCedis.map(Number).includes(Number(cedisId))) {
                    whereCedis = Number(cedisId);
                } else {
                    return [];
                }
            } else {
                whereCedis = { in: allowedCedis.map(Number) };
            }
        } else if (cedisId) {
            whereCedis = Number(cedisId);
        }

        return this.prisma.inventoryMovement.findMany({
            where: {
                cedisId: whereCedis,
                productId: productId ? +productId : undefined,
            },
            include: {
                product: true,
                cedis: true,
                user: true,
                evidence: true,
                movementType: { include: { category: true } },
                adjustments: {
                    include: {
                        user: true,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
            orderBy: { date: 'desc' },
        });
    }

    async getStock(cedisId?: number, allowedCedis?: number[]) {
        let whereCedis: any = undefined;
        if (allowedCedis && allowedCedis.length > 0) {
            if (cedisId) {
                if (allowedCedis.map(Number).includes(Number(cedisId))) {
                    whereCedis = Number(cedisId);
                } else {
                    return [];
                }
            } else {
                whereCedis = { in: allowedCedis.map(Number) };
            }
        } else if (cedisId) {
            whereCedis = Number(cedisId);
        }

        return this.prisma.inventoryStock.findMany({
            where: {
                cedisId: whereCedis,
            },
            include: {
                product: true,
                cedis: true,
            },
        });
    }
}
