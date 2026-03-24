import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
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
    recordMovement(
        @Body()
        data: {
            cedisId: number;
            productId: number;
            type: InventoryStartType;
            quantity: number;
            unitPrice?: number;
            userId?: number;
            notes?: string;
        },
    ) {
        return this.inventoryService.recordMovement(data);
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
