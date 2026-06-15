import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { MaintenanceStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('scheduled-maintenance')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ScheduledMaintenanceController {
  constructor(private readonly scheduledMaintenanceService: ScheduledMaintenanceService) {}

  @Post()
  @RequirePermissions('vehicles:update')
  create(@Body() body: any) {
    return this.scheduledMaintenanceService.create(body);
  }

  @Get()
  @RequirePermissions('vehicles:read')
  findAll(
    @Query('status') status: MaintenanceStatus, 
    @Query('vehicleId') vehicleId?: number,
    @Request() req?: any
  ) {
    return this.scheduledMaintenanceService.findAll(status, vehicleId, req?.user?.allowedCedis);
  }

  @Get('alerts')
  @RequirePermissions('vehicles:read')
  getAlerts(@Request() req) {
    return this.scheduledMaintenanceService.getAlerts(req.user?.allowedCedis);
  }

  @Get(':id')
  @RequirePermissions('vehicles:read')
  findOne(@Param('id') id: string) {
    return this.scheduledMaintenanceService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermissions('vehicles:update')
  update(@Param('id') id: string, @Body() body: any) {
    return this.scheduledMaintenanceService.update(+id, body);
  }

  @Delete(':id')
  @RequirePermissions('vehicles:delete')
  remove(@Param('id') id: string) {
    return this.scheduledMaintenanceService.remove(+id);
  }
}
