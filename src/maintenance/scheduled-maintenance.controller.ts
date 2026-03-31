import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { MaintenanceStatus } from '@prisma/client';

@Controller('scheduled-maintenance')
export class ScheduledMaintenanceController {
  constructor(private readonly scheduledMaintenanceService: ScheduledMaintenanceService) {}

  @Post()
  create(@Body() body: any) {
    return this.scheduledMaintenanceService.create(body);
  }

  @Get()
  findAll(@Query('status') status: MaintenanceStatus, @Query('vehicleId') vehicleId?: number) {
    return this.scheduledMaintenanceService.findAll(status, vehicleId);
  }

  @Get('alerts')
  getAlerts() {
    return this.scheduledMaintenanceService.getAlerts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scheduledMaintenanceService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.scheduledMaintenanceService.update(+id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.scheduledMaintenanceService.remove(+id);
  }
}
