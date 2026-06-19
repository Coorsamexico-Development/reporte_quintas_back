import { Controller, Get, Post, Body, Query, ParseIntPipe, UseInterceptors, UploadedFiles, Req, Param, ForbiddenException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InventoryService } from './inventory.service';
import { InventoryStartType } from '@prisma/client';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    @Post('movement')
    @Roles('ADMIN')
    @UseInterceptors(FilesInterceptor('evidence'))
    recordMovement(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: any,
        @Req() req: any
    ) {
        const cedisId = Number(body.cedisId);
        const allowed = req.user?.allowedCedis;
        if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
            throw new ForbiddenException('No tienes acceso a este CEDIS');
        }

        const data = {
            cedisId: Number(body.cedisId),
            productId: Number(body.productId),
            type: body.type as InventoryStartType,
            quantity: Number(body.quantity),
            unitPrice: body.unitPrice ? Number(body.unitPrice) : undefined,
            userId: body.userId ? Number(body.userId) : undefined,
            notes: body.notes,
        };
        return this.inventoryService.recordMovement(data, files);
    }

    @Post('movement/:id/adjust')
    adjustMovement(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { newQuantity: number; newUnitPrice?: number; reason: string },
        @Req() req: any
    ) {
        const userId = req.user.userId;
        return this.inventoryService.adjustMovement(id, {
            newQuantity: Number(body.newQuantity),
            newUnitPrice: body.newUnitPrice !== undefined ? Number(body.newUnitPrice) : undefined,
            reason: body.reason,
            userId,
        }, req.user?.allowedCedis);
    }

    @Get('movements')
    getMovements(
        @Req() req: any,
        @Query('cedisId') cedisId?: number,
        @Query('productId') productId?: number,
    ) {
        return this.inventoryService.getMovements(cedisId, productId, req.user?.allowedCedis);
    }

    @Get('stock')
    getStock(@Req() req: any, @Query('cedisId') cedisId?: number) {
        return this.inventoryService.getStock(cedisId, req.user?.allowedCedis);
    }
}
