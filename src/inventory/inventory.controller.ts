import { Controller, Get, Post, Body, Query, ParseIntPipe, UseInterceptors, UploadedFiles } from '@nestjs/common';
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
        @Body() body: any
    ) {
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

    @Get('movements')
    getMovements(
        @Query('cedisId') cedisId?: number,
        @Query('productId') productId?: number,
    ) {
        return this.inventoryService.getMovements(cedisId, productId);
    }

    @Get('stock')
    getStock(@Query('cedisId') cedisId?: number) {
        return this.inventoryService.getStock(cedisId);
    }
}
