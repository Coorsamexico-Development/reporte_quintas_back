import { Controller, Get, Post, Body, Param, Put, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehicleStatus, Role } from '@prisma/client';
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

    @Get(':id/history')
    @UseGuards(JwtAuthGuard)
    async getHistory(@Param('id') id: string) {
        return this.vehiclesService.getVehicleHistory(+id);
    }

    @Post()
    @Roles(Role.ADMIN)
    create(
        @Body()
        data: {
            plate: string;
            truckNumber: string;
            status: VehicleStatus;
            currentCedisId?: number;
        },
    ) {
        return this.vehiclesService.create(data);
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { plate?: string; truckNumber?: string; status?: VehicleStatus },
    ) {
        return this.vehiclesService.update(id, data);
    }

    @Post(':id/move')
    @UseGuards(JwtAuthGuard)
    moveVehicle(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { toCedisId: number; reason?: string },
        @Request() req
    ) {
        return this.vehiclesService.moveVehicle(id, data.toCedisId, req.user.userId, data.reason);
    }
}
