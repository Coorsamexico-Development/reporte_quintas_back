import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request, BadRequestException, ForbiddenException } from '@nestjs/common';
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

    @Get('history/all')
    @RequirePermissions('vehicles:read')
    async getAllHistory(@Request() req) {
        return this.vehiclesService.getAllVehiclesHistory(req.user?.allowedCedis);
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
        @Request() req
    ) {
        const allowed = req.user?.allowedCedis;
        if (allowed && allowed.length > 0 && data.currentCedisId) {
            if (!allowed.map(Number).includes(Number(data.currentCedisId))) {
                throw new ForbiddenException('No tienes acceso al CEDIS de destino');
            }
        }
        return this.vehiclesService.create(data);
    }

    @Put(':id')
    @RequirePermissions('vehicles:update')
    async update(
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
        @Request() req
    ) {
        const allowed = req.user?.allowedCedis;
        if (allowed && allowed.length > 0) {
            await this.vehiclesService.findOne(id, allowed);
            if (data.currentCedisId && !allowed.map(Number).includes(Number(data.currentCedisId))) {
                throw new ForbiddenException('No tienes acceso al CEDIS de destino');
            }
        }
        return this.vehiclesService.update(id, data);
    }

    @Post(':id/move')
    @RequirePermissions('vehicles:update')
    async moveVehicle(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { toCedisId: number; reason?: string },
        @Request() req
    ) {
        const allowed = req.user?.allowedCedis;
        if (allowed && allowed.length > 0) {
            await this.vehiclesService.findOne(id, allowed);
            if (!allowed.map(Number).includes(Number(data.toCedisId))) {
                throw new ForbiddenException('No tienes acceso al CEDIS de destino');
            }
        }
        return this.vehiclesService.moveVehicle(id, data.toCedisId, req.user.userId, data.reason);
    }

    @Delete('movement/:id')
    @RequirePermissions('vehicles:delete')
    deleteMovement(@Param('id', ParseIntPipe) id: number) {
        return this.vehiclesService.deleteMovement(id);
    }

    @Delete(':id')
    @RequirePermissions('vehicles:delete')
    async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
        const allowed = req.user?.allowedCedis;
        if (allowed && allowed.length > 0) {
            await this.vehiclesService.findOne(id, allowed);
        }
        return this.vehiclesService.remove(id);
    }
}
