import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Get('expenses')
    @Roles('ADMIN', 'OPERATOR') // All authenticated roles can view analytics
    async getExpenses() {
        return await this.analyticsService.getExpenses();
    }

    @Get('activity')
    @Roles('ADMIN', 'OPERATOR') // All authenticated roles can view analytics
    async getRecentActivity() {
        return await this.analyticsService.getRecentActivity();
    }

    @Get('global-summary')
    @Roles('ADMIN', 'OPERATOR')
    async getGlobalSummary() {
        return await this.analyticsService.getGlobalSummary();
    }
}
