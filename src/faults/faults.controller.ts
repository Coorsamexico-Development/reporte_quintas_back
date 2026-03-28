import { Controller, Get, Post, Body, Param, ParseIntPipe, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FaultsService, CreateFaultDto } from './faults.service';

@Controller('faults')
export class FaultsController {
  constructor(private readonly faultsService: FaultsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  reportFault(
    @Body() createFaultDto: CreateFaultDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.faultsService.reportFault(createFaultDto, file);
  }

  @Get('vehicle/:id')
  getVehicleFaults(@Param('id', ParseIntPipe) vehicleId: number) {
    return this.faultsService.getVehicleFaults(vehicleId);
  }

  @Get('alerts')
  getAlerts() {
    return this.faultsService.getAlerts();
  }
}
