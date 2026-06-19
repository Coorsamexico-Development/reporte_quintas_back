import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { CedisService } from './cedis.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('cedis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CedisController {
    constructor(private readonly cedisService: CedisService) { }

    @Get()
    findAll(@Request() req) {
        return this.cedisService.findAll(req.user?.allowedCedis);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
        return this.cedisService.findOne(id, req.user?.allowedCedis);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() data: { name: string; client?: string; location?: string; latitude?: number; longitude?: number }) {
        return this.cedisService.create(data);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: { name?: string; client?: string; location?: string; latitude?: number; longitude?: number }) {
        return this.cedisService.update(id, data);
    }

    @Delete(':id')
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.cedisService.remove(id);
    }
}
