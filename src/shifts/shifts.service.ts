import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftVehicleStatus } from '@prisma/client';

@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async findCedisShifts(cedisId: number) {
    return this.prisma.shift.findMany({
      where: { 
        cedisId,
        isActive: true,
      },
      orderBy: {
        id: 'asc',
      },
    });
  }

  async createShift(data: { name: string; startTime?: string; endTime?: string; cedisId: number }) {
    return this.prisma.shift.create({
      data: {
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        cedisId: Number(data.cedisId),
        isActive: true,
      },
    });
  }

  async updateShift(id: number, data: any, allowedCedis?: number[]) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(shift.cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }

    const updateData = { ...data };
    if (updateData.validUntil !== undefined) {
      updateData.validUntil = updateData.validUntil ? new Date(updateData.validUntil) : null;
    }
    return this.prisma.shift.update({
      where: { id },
      data: updateData,
    });
  }

  async removeShift(id: number, allowedCedis?: number[]) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(shift.cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }

    return this.prisma.shift.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findAssignments(cedisId: number, dateStr: string) {
    // Normalizar la fecha a medianoche UTC
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const [assignments, formResponses] = await Promise.all([
      this.prisma.vehicleShiftAssignment.findMany({
        where: {
          date,
          shift: {
            cedisId: Number(cedisId),
          },
        },
        include: {
          shift: true,
          vehicle: true,
        },
      }),
      this.prisma.vehicleShiftFormResponse.findMany({
        where: {
          date,
          shift: {
            cedisId: Number(cedisId),
          },
        },
        include: {
          answers: {
            include: {
              field: {
                include: {
                  fieldType: true,
                },
              },
            },
          },
        },
      })
    ]);

    return assignments.map(a => {
      const response = formResponses.find(r => r.shiftId === a.shiftId && r.vehicleId === a.vehicleId);
      return {
        ...a,
        formResponse: response ? {
          id: response.id,
          pdfUrl: response.pdfUrl,
          answers: response.answers,
        } : null,
      };
    });
  }

  async saveAssignments(data: { date: string; shiftId: number; assignments: { vehicleId: number; status: ShiftVehicleStatus }[] }, allowedCedis?: number[]) {
    const date = new Date(`${data.date}T00:00:00.000Z`);
    const shiftId = Number(data.shiftId);

    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(shift.cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }

    // Se realiza en una transacción para asegurar consistencia
    return this.prisma.$transaction(async (tx) => {
      // 1. Eliminar asignaciones previas para este turno y fecha
      await tx.vehicleShiftAssignment.deleteMany({
        where: {
          date,
          shiftId,
        },
      });

      // 2. Crear las nuevas asignaciones
      if (data.assignments && data.assignments.length > 0) {
        await tx.vehicleShiftAssignment.createMany({
          data: data.assignments.map((a) => ({
            date,
            shiftId,
            vehicleId: Number(a.vehicleId),
            status: a.status,
          })),
        });
      }

      return { success: true };
    });
  }

  async saveSingleAssignment(data: { date: string; shiftId: number; vehicleId: number; status: ShiftVehicleStatus | 'UNASSIGNED' }, allowedCedis?: number[]) {
    const date = new Date(`${data.date}T00:00:00.000Z`);
    const shiftId = Number(data.shiftId);
    const vehicleId = Number(data.vehicleId);

    const shift = await this.prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (allowedCedis && allowedCedis.length > 0 && !allowedCedis.map(Number).includes(shift.cedisId)) {
      throw new ForbiddenException('No tienes acceso a este CEDIS');
    }

    if (data.status === 'UNASSIGNED') {
      await this.prisma.vehicleShiftAssignment.deleteMany({
        where: {
          date,
          shiftId,
          vehicleId,
        },
      });
      return { success: true };
    } else {
      await this.prisma.vehicleShiftAssignment.upsert({
        where: {
          date_shiftId_vehicleId: {
            date,
            shiftId,
            vehicleId,
          },
        },
        update: {
          status: data.status as ShiftVehicleStatus,
        },
        create: {
          date,
          shiftId,
          vehicleId,
          status: data.status as ShiftVehicleStatus,
        },
      });
      return { success: true };
    }
  }
}
