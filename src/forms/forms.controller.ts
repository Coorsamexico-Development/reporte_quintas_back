import { Controller, Get, Post, Delete, Body, Param, Query, ParseIntPipe, UseGuards, Request, Res, ForbiddenException, NotFoundException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FormsService } from './forms.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('forms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('types')
  getFieldTypes() {
    return this.formsService.getFieldTypes();
  }

  @Get('cedis/:cedisId')
  findFormByCedis(@Param('cedisId', ParseIntPipe) cedisId: number, @Request() req) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      return null;
    }
    return this.formsService.findFormByCedis(cedisId);
  }

  @Post('cedis/:cedisId/fields')
  @Roles('ADMIN', 'OPERATOR')
  saveFormFields(
    @Param('cedisId', ParseIntPipe) cedisId: number,
    @Body() body: { fields: { id?: number; label: string; section?: string; options?: string; fieldTypeId: number; isRequired?: boolean; docSection?: string; columnNumber?: number }[] },
    @Request() req
  ) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }
    return this.formsService.saveFormFields(cedisId, body.fields);
  }

  @Get('response')
  findResponse(
    @Query('date') date: string,
    @Query('shiftId', ParseIntPipe) shiftId: number,
    @Query('vehicleId', ParseIntPipe) vehicleId: number,
  ) {
    return this.formsService.findResponse(date, shiftId, vehicleId);
  }

  @Get('completed-ids')
  findCompletedVehicleIds(
    @Query('cedisId', ParseIntPipe) cedisId: number,
    @Query('date') date: string,
    @Query('shiftId', ParseIntPipe) shiftId: number,
    @Request() req
  ) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      return [];
    }
    return this.formsService.findCompletedVehicleIds(cedisId, date, shiftId);
  }

  @Post('response')
  submitResponse(
    @Request() req,
    @Body() body: { date: string; shiftId: number; vehicleId: number; answers: { fieldId: number; value: string }[] },
  ) {
    const userId = Number(req.user?.userId);
    return this.formsService.submitResponse(userId, body);
  }

  @Get('inspections/pdf/:responseId')
  async downloadInspectionPdf(
    @Param('responseId', ParseIntPipe) responseId: number,
    @Res() res: Response,
  ) {
    const response = await this.formsService.findInspectionById(responseId);
    if (!response || !response.pdfUrl) {
      throw new NotFoundException(`No se encontró el PDF para la inspección con ID ${responseId}.`);
    }

    if (response.pdfUrl.startsWith('http')) {
      const signedUrl = await this.formsService.getInspectionPdfViewUrl(response.pdfUrl);
      return res.redirect(signedUrl);
    } else {
      const absolutePath = await this.formsService.findInspectionPdfPath(responseId);
      return res.sendFile(absolutePath);
    }
  }

  @Get('inspections/detail/:responseId')
  getInspectionDetail(@Param('responseId', ParseIntPipe) responseId: number) {
    return this.formsService.getInspectionDetail(responseId);
  }

  @Get('inspections/:vehicleId')
  findInspectionsByVehicle(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.formsService.findInspectionsByVehicle(vehicleId);
  }

  @Delete('inspections/:responseId')
  @Roles('ADMIN', 'OPERATOR')
  async deleteInspection(
    @Param('responseId', ParseIntPipe) responseId: number,
    @Request() req,
  ) {
    const inspection = await this.formsService.findInspectionById(responseId);
    if (!inspection) {
      throw new NotFoundException('Inspección no encontrada');
    }

    const allowed = req.user?.allowedCedis;
    const cedisId = inspection.form?.cedisId;
    if (cedisId && allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }

    return this.formsService.deleteInspection(responseId);
  }

  @Post('inspections/upload')
  @Roles('ADMIN', 'OPERATOR')
  @UseInterceptors(FileInterceptor('file'))
  async uploadInspection(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { date: string; shiftId: string; vehicleId: string },
  ) {
    if (!file) {
      throw new BadRequestException('El archivo de inspección es requerido');
    }
    const userId = Number(req.user?.userId);
    const vehicleId = Number(body.vehicleId);
    const shiftId = Number(body.shiftId);
    const dateStr = body.date;

    return this.formsService.uploadInspection(userId, {
      vehicleId,
      shiftId,
      date: dateStr,
      file,
    });
  }

  @Get('compliance-matrix')
  getComplianceMatrix(
    @Query('cedisId', ParseIntPipe) cedisId: number,
    @Query('date') date: string,
    @Request() req
  ) {
    const allowed = req.user?.allowedCedis;
    if (allowed && allowed.length > 0 && !allowed.map(Number).includes(cedisId)) {
      return { vehicles: [], completed: [] };
    }
    return this.formsService.getComplianceMatrix(cedisId, date);
  }
}
