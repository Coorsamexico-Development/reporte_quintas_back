import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

@Injectable()
export class MaintenanceService {
    constructor(private prisma: PrismaService) { }

    async createLog(data: {
        vehicleId: number;
        type: MaintenanceType;
        description: string;
        date: Date;
        status: MaintenanceStatus;
        providerId?: number;
        userId?: number;
        evidenceUrls?: string[];
        scheduledMaintenanceId?: number;
        resolvedFaultIds?: number[];
        tickets?: { ticketNumber: string; cost: number }[];
        parts?: { productId: number; quantity: number; cost: number }[];
    }) {
        const { evidenceUrls, tickets, parts, scheduledMaintenanceId, resolvedFaultIds, ...logData } = data;

        // If a scheduledMaintenanceId is provided, use it
        if (scheduledMaintenanceId) {
            const updatedMaintenance = await this.prisma.maintenance.update({
                where: { id: scheduledMaintenanceId },
                data: {
                    ...logData,
                    scheduledDate: undefined, // It's no longer just scheduled
                    evidence: {
                        create: evidenceUrls?.map((url) => ({ url })) || [],
                    },
                    tickets: {
                        create: tickets?.map(t => ({
                            ticketNumber: t.ticketNumber,
                            cost: t.cost,
                        })) || []
                    },
                    parts: {
                        create: parts?.map(p => ({
                            productId: p.productId,
                            quantity: p.quantity,
                            unitCost: p.cost,
                        })) || []
                    }
                },
                include: { evidence: true, tickets: true, parts: true },
            });

            if (resolvedFaultIds && resolvedFaultIds.length > 0) {
                await this.prisma.fault.updateMany({
                    where: { id: { in: resolvedFaultIds } },
                    data: { status: 'RESOLVED', resolvingMaintenanceId: updatedMaintenance.id, resolvedAt: new Date() },
                });
            }

            return updatedMaintenance;
        }

        // Fallback to auto-matching if it's preventive and completed
        if (logData.type === 'PREVENTIVE' && logData.status === 'COMPLETED') {
            const startDate = new Date(logData.date);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);

            const existingScheduled = await this.prisma.maintenance.findFirst({
                where: {
                    vehicleId: logData.vehicleId,
                    type: 'PREVENTIVE',
                    status: 'SCHEDULED',
                    date: {
                        gte: startDate,
                        lt: endDate
                    }
                }
            });

            if (existingScheduled) {
                // Update the existing scheduled record
                const updatedPreventive = await this.prisma.maintenance.update({
                    where: { id: existingScheduled.id },
                    data: {
                        ...logData,
                        scheduledDate: existingScheduled.date, // Preserve original planned date
                        evidence: {
                            create: evidenceUrls?.map((url) => ({ url })) || [],
                        },
                        tickets: {
                            create: tickets?.map(t => ({
                                ticketNumber: t.ticketNumber,
                                cost: t.cost,
                            })) || []
                        },
                        parts: {
                            create: parts?.map(p => ({
                                productId: p.productId,
                                quantity: p.quantity,
                                unitCost: p.cost,
                            })) || []
                        }
                    },
                    include: { evidence: true, tickets: true, parts: true },
                });

                if (resolvedFaultIds && resolvedFaultIds.length > 0) {
                    await this.prisma.fault.updateMany({
                        where: { id: { in: resolvedFaultIds } },
                        data: { status: 'RESOLVED', resolvingMaintenanceId: updatedPreventive.id, resolvedAt: new Date() },
                    });
                }

                return updatedPreventive;
            }
        }

        const newMaintenance = await this.prisma.maintenance.create({
            data: {
                ...logData,
                evidence: {
                    create: evidenceUrls?.map((url) => ({ url })) || [],
                },
                tickets: {
                    create: tickets?.map(t => ({
                        ticketNumber: t.ticketNumber,
                        cost: t.cost,
                    })) || []
                },
                parts: {
                    create: parts?.map(p => ({
                        productId: p.productId,
                        quantity: p.quantity,
                        unitCost: p.cost,
                    })) || []
                }
            },
            include: { evidence: true, tickets: true, parts: true },
        });

        if (resolvedFaultIds && resolvedFaultIds.length > 0) {
            await this.prisma.fault.updateMany({
                where: { id: { in: resolvedFaultIds } },
                data: { status: 'RESOLVED', resolvingMaintenanceId: newMaintenance.id, resolvedAt: new Date() },
            });
        }

        return newMaintenance;
    }

    async getScheduledMaintenances(vehicleId: number) {
        return this.prisma.maintenance.findMany({
            where: {
                vehicleId,
                status: 'SCHEDULED',
                type: 'PREVENTIVE',
            },
            orderBy: { date: 'asc' },
        });
    }

    async reportFault(data: {
        vehicleId: number;
        description: string;
        priority: string;
        date: Date;
    }) {
        return this.prisma.fault.create({
            data,
        });
    }

    async getPendingFaults(vehicleId: number) {
        return this.prisma.fault.findMany({
            where: {
                vehicleId,
                status: 'PENDING',
            },
            orderBy: { date: 'asc' },
        });
    }

    async getLogs(vehicleId?: number, providerId?: number) {
        return this.prisma.maintenance.findMany({
            where: {
                vehicleId: (vehicleId != null) ? Number(vehicleId) : undefined,
                providerId: (providerId != null) ? Number(providerId) : undefined,
            },
            include: {
                vehicle: true,
                provider: true,
                user: true,
                evidence: true,
                parts: {
                    include: {
                        product: true
                    }
                },
                tickets: true
            },
            orderBy: { date: 'desc' },
        });
    }

    async recordTireRotation(data: {
        vehicleId: number;
        date: Date;
        description: string;
        mileage?: number;
    }) {
        return this.prisma.tireRotation.create({
            data,
        });
    }

    async recordPartExchange(data: {
        vehicleId: number;
        date: Date;
        productId: number;
        action: string;
        description: string;
    }) {
        return this.prisma.partExchange.create({
            data: {
                vehicleId: data.vehicleId,
                date: data.date,
                productId: data.productId,
                action: data.action,
                description: data.description,
            }
        });
    }
}
