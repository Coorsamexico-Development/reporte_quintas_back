import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceType, MaintenanceStatus } from '@prisma/client';

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
        tickets?: { ticketNumber: string; cost: number }[];
        parts?: { productId: number; quantity: number; cost: number }[];
    }) {
        const { evidenceUrls, tickets, parts, ...logData } = data;
        return this.prisma.maintenance.create({
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
    }

    async getLogs(vehicleId?: number, providerId?: number) {
        return this.prisma.maintenance.findMany({
            where: {
                vehicleId: vehicleId ? +vehicleId : undefined,
                providerId: providerId ? +providerId : undefined,
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
