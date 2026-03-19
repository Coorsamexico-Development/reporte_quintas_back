import { Controller, Get, Post, Body, Param, Put, ParseIntPipe, UseGuards } from '@nestjs/common';
import { VehiclesService, VehicleStatus } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) { }

    @Get()
    findAll() {
        return this.vehiclesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.vehiclesService.findOne(id);
    }

    @Post()
    @Roles('ADMIN')
    create(
        @Body()
        data: {
            plate: string;
            truckNumber: string;
            status: VehicleStatus;
            currentCedisId?: number;
            engine?: string;
            yearModel?: number;
            transmission?: string;
            fuelType?: string;
            vin?: string;
        },
    ) {
        return this.vehiclesService.create(data);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { 
            plate?: string; 
            truckNumber?: string; 
            status?: VehicleStatus;
            currentCedisId?: number;
            engine?: string;
            yearModel?: number;
            transmission?: string;
            fuelType?: string;
            vin?: string;
        },
    ) {
        return this.vehiclesService.update(id, data);
    }

    @Post(':id/move')
    @Roles('ADMIN')
    moveVehicle(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { toCedisId: number; userId: number; reason?: string },
    ) {
        return this.vehiclesService.moveVehicle(id, data.toCedisId, data.userId, data.reason);
    }
}
