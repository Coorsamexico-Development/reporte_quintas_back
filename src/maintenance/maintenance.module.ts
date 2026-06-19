import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { ScheduledMaintenanceController } from './scheduled-maintenance.controller';
import { ScheduledMaintenanceService } from './scheduled-maintenance.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MaintenanceController, ScheduledMaintenanceController],
  providers: [MaintenanceService, ScheduledMaintenanceService],
})
export class MaintenanceModule { }
