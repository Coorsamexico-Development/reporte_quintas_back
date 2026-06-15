import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { VehicleStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) { }

    @Get()
    @RequirePermissions('vehicles:read')
    findAll(@Request() req) {
        return this.vehiclesService.findAll(req.user?.allowedCedis);
    }

    @Get(':id')
    @RequirePermissions('vehicles:read')
    findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.vehiclesService.findOne(id, req.user?.allowedCedis);
    }

    @Get(':id/history')
    @RequirePermissions('vehicles:read')
    async getHistory(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.vehiclesService.getVehicleHistory(id, req.user?.allowedCedis);
    }

    @Get('history/check-association/:type/:id')
    @RequirePermissions('vehicles:read')
    async checkAssociation(
        @Param('type') type: string,
        @Param('id', ParseIntPipe) id: number
    ) {
        return this.vehiclesService.checkEventAssociation(type, id);
    }

    @Post()
    @RequirePermissions('vehicles:create')
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
    @RequirePermissions('vehicles:update')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { 
            plate?: string; 
            truckNumber?: string; 
            status?: VehicleStatus;
            engine?: string;
            yearModel?: number;
            vin?: string;
            currentCedisId?: number;
            brandId?: number;
        },
    ) {
        return this.vehiclesService.update(id, data);
    }

    @Post(':id/move')
    @RequirePermissions('vehicles:update')
    moveVehicle(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { toCedisId: number; reason?: string },
        @Request() req
    ) {
        return this.vehiclesService.moveVehicle(id, data.toCedisId, req.user.userId, data.reason);
    }

    @Delete('movement/:id')
    @RequirePermissions('vehicles:delete')
    deleteMovement(@Param('id', ParseIntPipe) id: number) {
        return this.vehiclesService.deleteMovement(id);
    }

    @Delete(':id')
    @RequirePermissions('vehicles:delete')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.vehiclesService.remove(id);
    }
}
