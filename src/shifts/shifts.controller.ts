import { Controller, Get, Post, Body, Param, Put, Delete, Query, ParseIntPipe, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ShiftVehicleStatus } from '@prisma/client';

@Controller('shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get('cedis/:cedisId')
  findCedisShifts(@Param('cedisId', ParseIntPipe) cedisId: number, @Request() req) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      return [];
    }
    return this.shiftsService.findCedisShifts(cedisId);
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  createShift(
    @Body() data: { name: string; startTime?: string; endTime?: string; cedisId: number },
    @Request() req
  ) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(Number(data.cedisId))) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }
    return this.shiftsService.createShift(data);
  }

  @Put(':id')
  @Roles('ADMIN', 'OPERATOR')
  updateShift(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; startTime?: string; endTime?: string; isActive?: boolean },
    @Request() req
  ) {
    return this.shiftsService.updateShift(id, data, req.user?.allowedCedis);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OPERATOR')
  removeShift(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.shiftsService.removeShift(id, req.user?.allowedCedis);
  }

  @Get('assignments')
  findAssignments(
    @Query('cedisId', ParseIntPipe) cedisId: number,
    @Query('date') date: string,
    @Request() req
  ) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      return [];
    }
    return this.shiftsService.findAssignments(cedisId, date);
  }

  @Post('assignments')
  @Roles('ADMIN', 'OPERATOR')
  saveAssignments(
    @Body() data: { date: string; shiftId: number; assignments: { vehicleId: number; status: ShiftVehicleStatus }[] },
    @Request() req
  ) {
    return this.shiftsService.saveAssignments(data, req.user?.allowedCedis);
  }

  @Post('assignments/single')
  @Roles('ADMIN', 'OPERATOR')
  saveSingleAssignment(
    @Body() data: { date: string; shiftId: number; vehicleId: number; status: ShiftVehicleStatus | 'UNASSIGNED' },
    @Request() req
  ) {
    return this.shiftsService.saveSingleAssignment(data, req.user?.allowedCedis);
  }
}
