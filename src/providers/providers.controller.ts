import { Controller, Get, Post, Body, Param, Put, Delete, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('providers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProvidersController {
    constructor(private readonly providersService: ProvidersService) { }

    @Get()
    findAll(@Query('cedisId') cedisId?: number) {
        return this.providersService.findAll(cedisId);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.providersService.findOne(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() data: { name: string; contact?: string; services?: string; cedisId?: number }) {
        return this.providersService.create(data);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; contact?: string; services?: string },
    ) {
        return this.providersService.update(id, data);
    }

    @Delete(':id')
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.providersService.remove(id);
    }
}
