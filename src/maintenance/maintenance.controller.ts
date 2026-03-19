import { Controller, Get, Post, Body, Query, Param, ParseIntPipe, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { MaintenanceService, MaintenanceType, MaintenanceStatus } from './maintenance.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
    constructor(private readonly maintenanceService: MaintenanceService) { }

    @Post('log')
    @Roles('ADMIN')
    @UseInterceptors(FilesInterceptor('files', 10, {
        storage: diskStorage({
            destination: './uploads/maintenance',
            filename: (req, file, cb) => {
                const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
                return cb(null, `${randomName}${extname(file.originalname)}`);
            }
        })
    }))
    createLog(
        @Body()
        data: {
            vehicleId: string;
            type: MaintenanceType;
            description: string;
            date: string;
            status: MaintenanceStatus;
            providerId?: string;
            userId?: string;
            scheduledMaintenanceId?: string;
            resolvedFaultIds?: string; // Expecting a JSON string of number array
            tickets?: string; // These come as strings in multipart/form-data
            parts?: string;
        },
        @UploadedFiles() files: Array<Express.Multer.File>
    ) {
        const evidenceUrls = files?.map(file => `/uploads/maintenance/${file.filename}`) || [];
        
        // Convert string fields from multipart/form-data to their correct types
        const formattedData = {
            vehicleId: parseInt(data.vehicleId),
            type: data.type,
            description: data.description,
            date: new Date(data.date),
            status: data.status,
            providerId: data.providerId ? parseInt(data.providerId) : undefined,
            userId: data.userId ? parseInt(data.userId) : undefined,
            scheduledMaintenanceId: data.scheduledMaintenanceId ? parseInt(data.scheduledMaintenanceId) : undefined,
            evidenceUrls,
            resolvedFaultIds: data.resolvedFaultIds ? JSON.parse(data.resolvedFaultIds) : undefined,
            tickets: data.tickets ? JSON.parse(data.tickets) : [],
            parts: data.parts ? JSON.parse(data.parts) : [],
        };

        return this.maintenanceService.createLog(formattedData);
    }

    @Get('logs')
    getLogs(
        @Query('vehicleId', new ParseIntPipe({ optional: true })) vehicleId?: number,
        @Query('providerId', new ParseIntPipe({ optional: true })) providerId?: number,
    ) {
        return this.maintenanceService.getLogs(vehicleId, providerId);
    }

    @Get('scheduled/:vehicleId')
    getScheduled(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
        return this.maintenanceService.getScheduledMaintenances(vehicleId);
    }

    @Post('fault')
    reportFault(
        @Body()
        data: {
            vehicleId: number;
            description: string;
            priority: string;
            date: string;
        },
    ) {
        return this.maintenanceService.reportFault({
            vehicleId: data.vehicleId,
            description: data.description,
            priority: data.priority,
            date: new Date(data.date),
        });
    }

    @Get('faults/pending/:vehicleId')
    getPendingFaults(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
        return this.maintenanceService.getPendingFaults(vehicleId);
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
