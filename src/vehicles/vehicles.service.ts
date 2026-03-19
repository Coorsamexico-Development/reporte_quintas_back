import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export type VehicleStatus = 'ACTIVE' | 'MAINTENANCE' | 'IN_TRANSIT';

@Injectable()
export class VehiclesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.vehicle.findMany({
            include: {
                currentCedis: true,
                maintenanceLogs: {
                    include: { provider: true, parts: { include: { product: true } } },
                    orderBy: { date: 'desc' }
                },
                faults: {
                    orderBy: { date: 'desc' }
                },
                movementHistory: {
                    include: { fromCedis: true, toCedis: true },
                    orderBy: { date: 'desc' }
                },
                _count: {
                    select: { documents: true, maintenanceLogs: true },
                },
            },
        });
    }

    async findOne(id: number) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id },
            include: {
                currentCedis: true,
                documents: {
                    include: { type: true, evidence: true },
                },
                maintenanceLogs: {
                    include: { provider: true, user: true, evidence: true },
                },
                movementHistory: {
                    include: { fromCedis: true, toCedis: true, user: true },
                    orderBy: { date: 'desc' },
                },
                tireRotations: true,
                partExchanges: true,
            },
        });

        if (!vehicle) throw new NotFoundException('Vehicle not found');
        return vehicle;
    }

    async create(data: { 
        plate: string; 
        truckNumber: string; 
        status: VehicleStatus; 
        currentCedisId?: number;
        engine?: string;
        yearModel?: number;
        transmission?: string;
        fuelType?: string;
        vin?: string;
    }) {
        return this.prisma.vehicle.create({
            data,
        });
    }

    async update(id: number, data: { 
        plate?: string; 
        truckNumber?: string; 
        status?: VehicleStatus;
        currentCedisId?: number;
        engine?: string;
        yearModel?: number;
        transmission?: string;
        fuelType?: string;
        vin?: string;
    }) {
        return this.prisma.vehicle.update({
            where: { id },
            data,
        });
    }

    async moveVehicle(vehicleId: number, toCedisId: number, userId: number, reason?: string) {
        return this.prisma.$transaction(async (tx) => {
            const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
            if (!vehicle) throw new NotFoundException('Vehicle not found');

            const fromCedisId = vehicle.currentCedisId;

            const movement = await tx.vehicleMovement.create({
                data: {
                    vehicleId,
                    fromCedisId,
                    toCedisId,
                    userId,
                    reason,
                },
            });

            await tx.vehicle.update({
                where: { id: vehicleId },
                data: { currentCedisId: toCedisId },
            });

            return movement;
        });
    }
}
