import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    findAll() {
        return this.productsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.findOne(id);
    }

    @Post()
    @Roles('ADMIN')
    create(@Body() data: { name: string; code: string; description?: string; category: string }) {
        return this.productsService.create(data);
    }

    @Put(':id')
    @Roles('ADMIN')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; code?: string; description?: string; category?: string },
    ) {
        return this.productsService.update(id, data);
    }

    @Delete(':id')
    @Roles('ADMIN')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.productsService.remove(id);
    }
}
