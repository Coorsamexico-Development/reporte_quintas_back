import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('expenses')
    @Roles('ADMIN', 'OPERATOR', 'CLIENTE')
    async getExpenses() {
        return await this.analyticsService.getExpenses();
    }

    @Get('activity')
    @Roles('ADMIN', 'OPERATOR')
    async getRecentActivity() {
        return await this.analyticsService.getRecentActivity();
    }

    @Get('global-summary')
    @Roles('ADMIN', 'OPERATOR', 'CLIENTE')
    async getGlobalSummary() {
        return await this.analyticsService.getGlobalSummary();
    }

    @Get('operational-trends')
    @Roles('ADMIN', 'OPERATOR', 'CLIENTE')
    async getOperationalTrends(@Query('cedisId') cedisId?: string) {
        return await this.analyticsService.getOperationalTrends(cedisId ? Number(cedisId) : undefined);
    }
}
