import { Controller, Get, Post, Delete, Query, Body, Param, ParseIntPipe, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FaultsService, CreateFaultDto } from './faults.service';

@Controller('faults')
export class FaultsController {
  constructor(private readonly faultsService: FaultsService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  reportFault(
    @Body() createFaultDto: CreateFaultDto,
    @UploadedFiles() files?: Express.Multer.File[]
  ) {
    return this.faultsService.reportFault(createFaultDto, files);
  }

  @Get('vehicle/:id')
  getVehicleFaults(@Param('id', ParseIntPipe) vehicleId: number) {
    return this.faultsService.getVehicleFaults(vehicleId);
  }

  @Get('alerts')
  getAlerts() {
    return this.faultsService.getAlerts();
  }

  @Delete(':id')
  deleteFault(
    @Param('id', ParseIntPipe) id: number,
    @Query('unlink') unlink?: string
  ) {
    const shouldUnlink = unlink !== 'false';
    return this.faultsService.deleteFault(id, shouldUnlink);
  }
}
