import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceType_OLD, MaintenanceStatus } from '@prisma/client';

@Injectable()
export class ScheduledMaintenanceService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    vehicleId: number;
    title: string;
    description?: string;
    date: Date;
    type?: MaintenanceType_OLD;
    maintenanceTypeId?: number;
    status?: MaintenanceStatus;
  }) {
    return this.prisma.scheduledMaintenance.create({
      data: {
        ...data,
        maintenanceTypeId: data.maintenanceTypeId ? +data.maintenanceTypeId : undefined,
        date: new Date(data.date),
      },
      include: { vehicle: true, maintenanceType: true },
    });
  }

  async findAll(status?: MaintenanceStatus, vehicleId?: number) {
    return this.prisma.scheduledMaintenance.findMany({
      where: {
        status: status || undefined,
        vehicleId: vehicleId ? +vehicleId : undefined,
      },
      include: {
        vehicle: true,
        maintenanceType: true,
      },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(id: number) {
    return this.prisma.scheduledMaintenance.findUnique({
      where: { id },
      include: {
        vehicle: true,
        maintenances: true,
      },
    });
  }

  async update(id: number, data: any) {
    return this.prisma.scheduledMaintenance.update({
      where: { id },
      data: {
        ...data,
        maintenanceTypeId: data.maintenanceTypeId ? +data.maintenanceTypeId : undefined,
        date: data.date ? new Date(data.date) : undefined,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.scheduledMaintenance.delete({
      where: { id },
    });
  }

  async getAlerts() {
    // Alertas son los pendientes o vencidos (fecha <= hoy + 7 días por ejemplo, o simplemente PENDING)
    return this.prisma.scheduledMaintenance.findMany({
      where: {
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
      },
      include: {
        vehicle: true,
        maintenanceType: true,
      },
      orderBy: { date: 'asc' },
    });
  }
}
