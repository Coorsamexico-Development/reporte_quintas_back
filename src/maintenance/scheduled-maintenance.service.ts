import { Injectable, BadRequestException } from '@nestjs/common';
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
    const inputDate = new Date(data.date);
    const startOfDay = new Date(inputDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(inputDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const existing = await this.prisma.scheduledMaintenance.findFirst({
      where: {
        vehicleId: +data.vehicleId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Esta unidad ya tiene un mantenimiento programado para este día.');
    }

    return this.prisma.scheduledMaintenance.create({
      data: {
        ...data,
        maintenanceTypeId: data.maintenanceTypeId ? +data.maintenanceTypeId : undefined,
        date: inputDate,
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
    if (data.date || data.vehicleId) {
      const existingRecord = await this.prisma.scheduledMaintenance.findUnique({ where: { id } });
      if (!existingRecord) {
        throw new BadRequestException('Mantenimiento programado no encontrado.');
      }
      
      const vehicleId = data.vehicleId ? +data.vehicleId : existingRecord.vehicleId;
      const dateToCheck = data.date ? new Date(data.date) : existingRecord.date;
      
      const startOfDay = new Date(dateToCheck);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(dateToCheck);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const conflict = await this.prisma.scheduledMaintenance.findFirst({
        where: {
          id: { not: id },
          vehicleId: vehicleId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      if (conflict) {
        throw new BadRequestException('Esta unidad ya tiene un mantenimiento programado para este día.');
      }
    }

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
