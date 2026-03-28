import { Controller, Get, Post, Put, Body, Query, Param, ParseIntPipe } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceType, MaintenanceStatus } from '@prisma/client';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Post('log')
    @Roles('ADMIN')
    createLog(
        @Body()
        data: {
            vehicleId: number;
            type: MaintenanceType;
            description: string;
            date: Date;
            status: MaintenanceStatus;
            providerId?: number;
            userId?: number;
            evidenceUrls?: string[];
            resolvedFaultIds?: number[];
            tickets?: { 
                ticketNumber: string; 
                cost: number; 
                items?: { description: string; cost: number }[] 
            }[];
            parts?: { productId: number; quantity: number; cost: number }[];
        },
    ) {
        if (data.date) data.date = new Date(data.date);
        return this.maintenanceService.createLog(data);
    }

    @Put('log/:id')
    @Roles('ADMIN')
    updateLog(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: any
    ) {
        return this.maintenanceService.updateLog(id, data);
    }

    @Get('logs')
    getLogs(
        @Query('vehicleId') vehicleId?: number,
        @Query('providerId') providerId?: number,
    ) {
        return this.maintenanceService.getLogs(vehicleId, providerId);
    }

    @Post('tire-rotation')
    @Roles('ADMIN')
    recordTireRotation(
        @Body()
        data: {
            vehicleId: number;
            date: Date;
            description: string;
            mileage?: number;
        },
    ) {
        if (data.date) data.date = new Date(data.date);
        return this.maintenanceService.recordTireRotation(data);
    }

    @Post('part-exchange')
    @Roles('ADMIN')
    recordPartExchange(
        @Body()
        data: {
            vehicleId: number;
            date: Date;
            productId: number;
            action: string;
            description: string;
        },
    ) {
        if (data.date) data.date = new Date(data.date);
        return this.maintenanceService.recordPartExchange(data);
    }
}
