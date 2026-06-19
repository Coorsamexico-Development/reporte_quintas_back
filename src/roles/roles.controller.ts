import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RolesController {
    constructor(private readonly rolesService: RolesService) { }

    @Get()
    @RequirePermissions('users:read')
    findAll() {
        return this.rolesService.findAll();
    }

    @Get(':id')
    @RequirePermissions('users:read')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.rolesService.findOne(id);
    }

    @Post()
    @RequirePermissions('users:create')
    create(@Body() data: { name: string; description?: string; permissions: any }) {
        return this.rolesService.create(data);
    }

    @Put(':id')
    @RequirePermissions('users:update')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; description?: string; permissions?: any }
    ) {
        return this.rolesService.update(id, data);
    }

    @Delete(':id')
    @RequirePermissions('users:delete')
    async remove(@Param('id', ParseIntPipe) id: number) {
        try {
            return await this.rolesService.remove(id);
        } catch (error) {
            throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
        }
    }
}
