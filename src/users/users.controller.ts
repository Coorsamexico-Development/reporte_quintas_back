import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles('ADMIN')
    findAll() {
        return this.usersService.findAll();
    }

    @Get(':id')
    @Roles('ADMIN')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.findOne(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() data: { name: string; email: string; role: string; password?: string }) {
        // Basic password handling if not provided
        if (!data.password) data.password = 'default123';
        return this.usersService.create(data as any);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; email?: string; role?: string },
    ) {
        return this.usersService.update(id, data);
    }

    @Delete(':id')
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.usersService.remove(id);
    }
}
