import { Controller, Get, Post, Put, Body, Query, Param, ParseIntPipe, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
    @UseInterceptors(FilesInterceptor('evidence'))
    createLog(
        @UploadedFiles() files: Express.Multer.File[],
        @Body()
        data: any,
    ) {
        if (data.date) data.date = new Date(data.date);
        return this.maintenanceService.createLog(data, files);
    }

    @Put('log/:id')
    @Roles('ADMIN')
    @UseInterceptors(FilesInterceptor('evidence'))
    updateLog(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() data: any
    ) {
        return this.maintenanceService.updateLog(id, data, files);
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
