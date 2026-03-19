import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
    constructor(private readonly catalogsService: CatalogsService) { }

    @Get('transmissions')
    findAllTransmissions() {
        return this.catalogsService.findAllTransmissions();
    }

    @Get('fuel-types')
    findAllFuelTypes() {
        return this.catalogsService.findAllFuelTypes();
    }

    @Get('model-years')
    findAllModelYears() {
        return this.catalogsService.findAllModelYears();
    }

    // Transmissions
    @Post('transmissions')
    @Roles('ADMIN')
    createTransmission(@Body() data: { name: string }) {
        return this.catalogsService.createTransmission(data);
    }
    @Put('transmissions/:id')
    @Roles('ADMIN')
    updateTransmission(@Param('id', ParseIntPipe) id: number, @Body() data: { name: string }) {
        return this.catalogsService.updateTransmission(id, data);
    }
    @Delete('transmissions/:id')
    @Roles('ADMIN')
    removeTransmission(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.removeTransmission(id);
    }

    // Fuel Types
    @Post('fuel-types')
    @Roles('ADMIN')
    createFuelType(@Body() data: { name: string }) {
        return this.catalogsService.createFuelType(data);
    }
    @Put('fuel-types/:id')
    @Roles('ADMIN')
    updateFuelType(@Param('id', ParseIntPipe) id: number, @Body() data: { name: string }) {
        return this.catalogsService.updateFuelType(id, data);
    }
    @Delete('fuel-types/:id')
    @Roles('ADMIN')
    removeFuelType(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.removeFuelType(id);
    }

    // Model Years
    @Post('model-years')
    @Roles('ADMIN')
    createModelYear(@Body() data: { year: number }) {
        return this.catalogsService.createModelYear(data);
    }
    @Put('model-years/:id')
    @Roles('ADMIN')
    updateModelYear(@Param('id', ParseIntPipe) id: number, @Body() data: { year: number }) {
        return this.catalogsService.updateModelYear(id, data);
    }
    @Delete('model-years/:id')
    @Roles('ADMIN')
    removeModelYear(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.removeModelYear(id);
    }

    // Document Types
    @Get('document-types')
    findAllDocumentTypes() {
        return this.catalogsService.findAllDocumentTypes();
    }
    @Post('document-types')
    @Roles('ADMIN')
    createDocumentType(@Body() data: { name: string; description?: string; alertDays?: number }) {
        return this.catalogsService.createDocumentType(data);
    }
    @Put('document-types/:id')
    @Roles('ADMIN')
    updateDocumentType(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; description?: string; alertDays?: number }) {
        return this.catalogsService.updateDocumentType(id, data);
    }
    @Delete('document-types/:id')
    @Roles('ADMIN')
    removeDocumentType(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.removeDocumentType(id);
    }
}
