import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CatalogsController {
    constructor(private readonly catalogsService: CatalogsService) { }

    // Brands
    @Get('brands')
    @RequirePermissions('catalogs:read')
    findAllBrands() {
        return this.catalogsService.findAllBrands();
    }

    @Post('brands')
    @RequirePermissions('catalogs:create')
    createBrand(@Body('name') name: string) {
        return this.catalogsService.createBrand(name);
    }

    @Delete('brands/:id')
    @RequirePermissions('catalogs:delete')
    deleteBrand(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteBrand(id);
    }

    // Transmissions
    @Get('transmissions')
    @RequirePermissions('catalogs:read')
    findAllTransmissions() {
        return this.catalogsService.findAllTransmissions();
    }

    @Post('transmissions')
    @RequirePermissions('catalogs:create')
    createTransmission(@Body('name') name: string) {
        return this.catalogsService.createTransmission(name);
    }

    @Delete('transmissions/:id')
    @RequirePermissions('catalogs:delete')
    deleteTransmission(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteTransmission(id);
    }

    // Fuel Types
    @Get('fuel-types')
    @RequirePermissions('catalogs:read')
    findAllFuelTypes() {
        return this.catalogsService.findAllFuelTypes();
    }

    @Post('fuel-types')
    @RequirePermissions('catalogs:create')
    createFuelType(@Body('name') name: string) {
        return this.catalogsService.createFuelType(name);
    }

    @Delete('fuel-types/:id')
    @RequirePermissions('catalogs:delete')
    deleteFuelType(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteFuelType(id);
    }

    // Maintenance Types
    @Get('maintenance-types')
    @RequirePermissions('catalogs:read')
    findAllMaintenanceTypes() {
        return this.catalogsService.findAllMaintenanceTypes();
    }

    @Post('maintenance-types')
    @RequirePermissions('catalogs:create')
    createMaintenanceType(@Body('name') name: string) {
        return this.catalogsService.createMaintenanceType(name);
    }

    @Delete('maintenance-types/:id')
    @RequirePermissions('catalogs:delete')
    deleteMaintenanceType(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteMaintenanceType(id);
    }
}
