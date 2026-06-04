import { Controller, Get, Post, Put, Delete, Body, Query, Param, ParseIntPipe, UseInterceptors, UploadedFiles, Req } from '@nestjs/common';
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
        @Body() data: any,
        @Req() req: any
    ) {
        if (data.date) data.date = new Date(data.date);
        return this.maintenanceService.createLog(data, files, req.user?.userId);
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
    @UseInterceptors(FilesInterceptor('evidence'))
    recordPartExchange(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() data: any,
    ) {
        const payload = {
            vehicleId: Number(data.vehicleId),
            productId: Number(data.productId),
            targetVehicleId: data.targetVehicleId ? Number(data.targetVehicleId) : undefined,
            date: data.date ? new Date(data.date) : new Date(),
            action: data.action,
            description: data.description,
        };
        return this.maintenanceService.recordPartExchange(payload, files);
    }

    @Delete('log/:id')
    @Roles('ADMIN')
    deleteLog(
        @Param('id', ParseIntPipe) id: number,
        @Query('unlink') unlink?: string
    ) {
        const shouldUnlink = unlink !== 'false';
        return this.maintenanceService.deleteLog(id, shouldUnlink);
    }

    @Delete('part-exchange/:id')
    @Roles('ADMIN')
    deletePartExchange(@Param('id', ParseIntPipe) id: number) {
        return this.maintenanceService.deletePartExchange(id);
    }

    @Delete('tire-rotation/:id')
    @Roles('ADMIN')
    deleteTireRotation(@Param('id', ParseIntPipe) id: number) {
        return this.maintenanceService.deleteTireRotation(id);
    }
}
