import { Controller, Get, Post, Delete, Query, Body, Param, ParseIntPipe, UseInterceptors, UploadedFiles, UseGuards, Request } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FaultsService, CreateFaultDto } from './faults.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('faults')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class FaultsController {
  constructor(private readonly faultsService: FaultsService) {}

  @Post()
  @RequirePermissions('vehicles:update')
  @UseInterceptors(FilesInterceptor('files'))
  reportFault(
    @Body() createFaultDto: CreateFaultDto,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    return this.faultsService.reportFault(createFaultDto, files);
  }

  @Get('vehicle/:id')
  @RequirePermissions('vehicles:read')
  getVehicleFaults(@Param('id', ParseIntPipe) vehicleId: number) {
    return this.faultsService.getVehicleFaults(vehicleId);
  }

  @Get('alerts')
  @RequirePermissions('vehicles:read')
  getAlerts(@Request() req) {
    return this.faultsService.getAlerts(req.user?.allowedCedis);
  }

  @Delete(':id')
  @RequirePermissions('vehicles:update')
  deleteFault(
    @Param('id', ParseIntPipe) id: number,
    @Query('unlink') unlink?: string
  ) {
    const shouldUnlink = unlink !== 'false';
    return this.faultsService.deleteFault(id, shouldUnlink);
  }
}
