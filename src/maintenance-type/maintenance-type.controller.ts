import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MaintenanceTypeService } from './maintenance-type.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('maintenance-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceTypeController {
  constructor(private readonly service: MaintenanceTypeService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() data: { name: string; description?: string }) {
    return this.service.create(data);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
