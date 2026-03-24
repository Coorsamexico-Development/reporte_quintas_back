import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CedisService } from './cedis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('cedis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CedisController {
    constructor(private readonly cedisService: CedisService) { }

    @Get()
    findAll() {
        return this.cedisService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.cedisService.findOne(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() data: { name: string; location?: string }) {
        return this.cedisService.create(data);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; location?: string }) {
        return this.cedisService.update(id, data);
    }

    @Delete(':id')
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.cedisService.remove(id);
    }
}
