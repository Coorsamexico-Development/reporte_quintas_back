import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VehicleStatus } from '@prisma/client';

@Injectable()
export class VehiclesService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.vehicle.findMany({
            include: {
                currentCedis: true,
                brand: true,
                transmissionRel: true,
                fuelTypeRel: true,
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
                brand: true,
                transmissionRel: true,
                fuelTypeRel: true,
                documents: {
                    include: { type: true, evidence: true },
                },
                maintenanceLogs: {
                    include: { provider: true, user: true, evidence: true, tickets: { include: { items: true } } },
                },
                movementHistory: {
                    include: { fromCedis: true, toCedis: true, user: true },
                    orderBy: { date: 'desc' },
                },
                tireRotations: true,
                partExchanges: {
                    include: { product: true }
                },
                faults: true
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
        brandId?: number;
        transmissionId?: number;
        fuelTypeId?: number;
        engine?: string;
        yearModel?: number;
        vin?: string;
    }) {
        return this.prisma.vehicle.create({
            data,
        });
    }

    async update(id: number, data: { plate?: string; truckNumber?: string; status?: VehicleStatus }) {
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
    async getVehicleHistory(id: number) {
        const vehicle = await this.prisma.vehicle.findUnique({
            where: { id },
            include: {
                maintenanceLogs: {
                    include: { 
                        provider: true, 
                        user: true, 
                        evidence: true, 
                        tickets: { include: { items: true } },
                        parts: { include: { product: true } }
                    },
                    orderBy: { date: 'desc' }
                },
                movementHistory: {
                    include: { fromCedis: true, toCedis: true, user: true, evidence: true },
                    orderBy: { date: 'desc' }
                },
                faults: {
                    include: { evidence: true },
                    orderBy: { reportedAt: 'desc' }
                },
                partExchanges: {
                    include: { product: true },
                    orderBy: { date: 'desc' }
                },
                tireRotations: {
                    orderBy: { date: 'desc' }
                },
                scheduledMaintenances: {
                    orderBy: { date: 'desc' }
                }
            }
        });

        if (!vehicle) throw new NotFoundException('Vehicle not found');

        // Map and sort all events into a single timeline
        const events: any[] = [
            ...vehicle.maintenanceLogs.map(log => ({
                id: `maintenance-${log.id}`,
                type: 'MAINTENANCE',
                logId: log.id,
                date: log.date,
                title: 'Mantenimiento ' + (log.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'),
                description: log.description,
                user: log.user?.name,
                meta: { 
                    provider: log.provider,
                    status: log.status, 
                    tickets: log.tickets,
                    parts: log.parts,
                    type: log.type,
                    endDate: log.endDate,
                    inactiveDays: log.inactiveDays,
                    inactiveHours: log.inactiveHours
                },
                evidence: log.evidence.map(e => e.url)
            })),
            ...vehicle.movementHistory.map(mov => ({
                id: `movement-${mov.id}`,
                type: 'MOVEMENT',
                date: mov.date,
                title: 'Movimiento de CEDIS',
                description: mov.reason || `Traslado de ${mov.fromCedis?.name || 'Origen desconocido'} a ${mov.toCedis.name}`,
                user: mov.user.name,
                meta: { from: mov.fromCedis?.name, to: mov.toCedis.name },
                evidence: mov.evidence.map(e => e.url)
            })),
            ...vehicle.faults.map(fault => ({
                id: `fault-${fault.id}`,
                type: 'FAULT',
                date: fault.reportedAt,
                title: 'Reporte de Avería',
                description: fault.description,
                meta: { 
                    severity: fault.severity, 
                    status: fault.status,
                    resolvedAt: fault.resolvedAt 
                },
                evidence: fault.evidence.map(e => e.url)
            })),
            ...vehicle.partExchanges.map(ex => ({
                id: `exchange-${ex.id}`,
                type: 'PART_EXCHANGE',
                date: ex.date,
                title: 'Cambio de Pieza',
                description: `${ex.action === 'REMOVED' ? 'Se retiró' : 'Se recibió'} ${ex.product.name}`,
                meta: { product: ex.product.name, action: ex.action }
            })),
            ...vehicle.tireRotations.map(rot => ({
                id: `tire-${rot.id}`,
                type: 'TIRE_ROTATION',
                date: rot.date,
                title: 'Rotación de Llantas',
                description: rot.description,
                meta: { mileage: rot.mileage }
            })),
            ...vehicle.scheduledMaintenances.map(sched => ({
                id: `scheduled-${sched.id}`,
                type: 'SCHEDULED_MAINTENANCE',
                date: sched.date,
                title: 'Programación: ' + (sched.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'),
                description: sched.description,
                meta: { status: sched.status },
            })),
            {
                id: `alta-${vehicle.id}`,
                type: 'ALTA',
                date: vehicle.createdAt,
                title: 'Alta de Unidad',
                description: `Ingreso de la unidad ${vehicle.truckNumber} al sistema.`,
                meta: { plate: vehicle.plate }
            }
        ];

        return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}
