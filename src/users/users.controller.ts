import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @RequirePermissions('users:read')
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    @RequirePermissions('users:read')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.findOne(id);
    }

    @Post()
    @RequirePermissions('users:create')
    create(@Body() data: { name: string; email: string; roleId: number; password?: string }) {
        // Basic password handling if not provided
        if (!data.password) data.password = 'default123';
        return this.usersService.create(data as any);
    }

    @Put(':id')
    @RequirePermissions('users:update')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; email?: string; roleId?: number },
    ) {
        return this.usersService.update(id, data);
    }

    @Delete(':id')
    @RequirePermissions('users:delete')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.remove(id);
    }
}

