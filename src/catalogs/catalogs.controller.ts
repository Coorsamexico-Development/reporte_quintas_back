import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CatalogsService } from './catalogs.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
    constructor(private readonly catalogsService: CatalogsService) { }

    // Brands
    @Get('brands')
    findAllBrands() {
        return this.catalogsService.findAllBrands();
    }

    @Post('brands')
    @Roles('ADMIN')
    createBrand(@Body('name') name: string) {
        return this.catalogsService.createBrand(name);
    }

    @Delete('brands/:id')
    @Roles('ADMIN')
    deleteBrand(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteBrand(id);
    }

    // Transmissions
    @Get('transmissions')
    findAllTransmissions() {
        return this.catalogsService.findAllTransmissions();
    }

    @Post('transmissions')
    @Roles('ADMIN')
    createTransmission(@Body('name') name: string) {
        return this.catalogsService.createTransmission(name);
    }

    @Delete('transmissions/:id')
    @Roles('ADMIN')
    deleteTransmission(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteTransmission(id);
    }

    // Fuel Types
    @Get('fuel-types')
    findAllFuelTypes() {
        return this.catalogsService.findAllFuelTypes();
    }

    @Post('fuel-types')
    @Roles('ADMIN')
    createFuelType(@Body('name') name: string) {
        return this.catalogsService.createFuelType(name);
    }

    @Delete('fuel-types/:id')
    @Roles('ADMIN')
    deleteFuelType(@Param('id', ParseIntPipe) id: number) {
        return this.catalogsService.deleteFuelType(id);
    }
}
