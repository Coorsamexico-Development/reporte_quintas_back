import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceType_OLD, MaintenanceStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MaintenanceService {
    constructor(
        private prisma: PrismaService,
        private storage: StorageService
    ) { }

    async createLog(data: any, files?: Express.Multer.File[]) {
        let { evidenceUrls, tickets, parts, resolvedFaultIds, scheduledId, maintenanceTypeId, ...logData } = data;
        
        // Parse JSON strings from FormData if necessary
        if (typeof tickets === 'string') tickets = JSON.parse(tickets);
        if (typeof parts === 'string') parts = JSON.parse(parts);
        if (typeof resolvedFaultIds === 'string') resolvedFaultIds = JSON.parse(resolvedFaultIds);

        const vehicleId = Number(logData.vehicleId);
        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        const truckNumber = vehicle?.truckNumber || 'unknown';

        if (files && files.length > 0) {
            const uploadedUrls = await Promise.all(
                files.map(file => this.storage.uploadFile(file, `unidades/${truckNumber}/mantenimientos`))
            );
            evidenceUrls = uploadedUrls;
        }
        
        console.log('Final data for Prisma.maintenance.create:', {
            vehicleId: Number(logData.vehicleId),
            type: logData.type,
            description: logData.description,
            date: logData.date,
            maintenanceTypeId: maintenanceTypeId ? +maintenanceTypeId : undefined,
        });

        return this.prisma.$transaction(async (tx) => {
            const log = await tx.maintenance.create({
                data: {
                    vehicleId: Number(logData.vehicleId),
                    type: logData.type || 'PREVENTIVE',
                    description: logData.description || '',
                    date: logData.date ? new Date(logData.date) : new Date(),
                    maintenanceTypeId: maintenanceTypeId ? +maintenanceTypeId : undefined,
                    scheduledMaintenanceId: scheduledId ? +scheduledId : undefined,
                    evidence: {
                        create: evidenceUrls?.map((url) => ({ url })) || [],
                    },
                    tickets: {
                        create: tickets?.map(t => {
                            // Calculate ticket cost if missing or use provided
                            const ticketItems = t.items?.map(i => {
                                const prodId = Number(i.productId);
                                const typeId = Number(i.maintenanceTypeId);
                                return {
                                    description: i.description || '',
                                    repairType: i.repairType,
                                    maintenanceTypeId: (!isNaN(typeId) && typeId > 0) ? typeId : undefined,
                                    productId: (!isNaN(prodId) && prodId > 0) ? prodId : undefined,
                                    cost: Number(i.cost) || 0,
                                    laborCost: Number(i.laborCost) || 0,
                                    hasIva: i.hasIva === true,
                                    affectedParts: Number(i.affectedParts) || 1
                                };
                            }) || [];

                            const tCost = Number(t.cost) || ticketItems.reduce((acc, curr) => {
                                let total = acc + curr.cost + curr.laborCost;
                                if (curr.hasIva) total += (curr.cost + curr.laborCost) * 0.16;
                                return total;
                            }, 0);

                            return {
                                ticketNumber: t.ticketNumber || 'N/A',
                                cost: tCost,
                                items: {
                                    create: ticketItems
                                }
                            };
                        }) || []
                    },
                    parts: {
                        create: parts?.map(p => {
                            const pid = Number(p.productId);
                            return (!isNaN(pid) && pid > 0) ? {
                                productId: pid,
                                quantity: Number(p.quantity) || 1,
                                unitCost: Number(p.cost) || 0,
                            } : null;
                        }).filter(Boolean) || []
                    }
                },
                include: { evidence: true, tickets: { include: { items: true } }, parts: true },
            });

            if (resolvedFaultIds && resolvedFaultIds.length > 0) {
                await tx.fault.updateMany({
                    where: { id: { in: resolvedFaultIds } },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: new Date(),
                        maintenanceId: log.id
                    }
                });
            }

            if (scheduledId) {
                await tx.scheduledMaintenance.update({
                    where: { id: +scheduledId },
                    data: { status: 'COMPLETED' }
                });
            }

            return log;
        });
    }

    async updateLog(id: number, data: any, files?: Express.Multer.File[]) {
        let { scheduledId, evidenceUrls, tickets, parts, resolvedFaultIds, existingEvidence, maintenanceTypeId, ...rest } = data;
        
        // Parse JSON
        if (typeof tickets === 'string') tickets = JSON.parse(tickets);
        if (typeof existingEvidence === 'string') existingEvidence = JSON.parse(existingEvidence);

        const log = await this.prisma.maintenance.findUnique({ where: { id }, include: { vehicle: true } });
        const truckNumber = log?.vehicle?.truckNumber || 'unknown';

        let finalEvidenceUrls = existingEvidence || [];

        if (files && files.length > 0) {
            const uploadedUrls = await Promise.all(
                files.map(file => this.storage.uploadFile(file, `unidades/${truckNumber}/mantenimientos`))
            );
            finalEvidenceUrls = [...finalEvidenceUrls, ...uploadedUrls];
        }
        
        return this.prisma.$transaction(async (tx) => {
            // Update the current maintenance log
            const updated = await tx.maintenance.update({
                where: { id },
                data: {
                    vehicleId: rest.vehicleId ? Number(rest.vehicleId) : undefined,
                    description: rest.description,
                    maintenanceTypeId: maintenanceTypeId ? +maintenanceTypeId : undefined,
                    scheduledMaintenanceId: scheduledId ? +scheduledId : undefined,
                    date: rest.date ? new Date(rest.date) : undefined,
                    // Handle evidence updates if provided
                    evidence: {
                        deleteMany: {}, // Simple approach: replace evidence
                        create: finalEvidenceUrls.map((url: string) => ({ url }))
                    },
                    // Handle ticket updates if provided
                    ...(tickets && {
                        tickets: {
                            deleteMany: {}, // Warning: this deletes old ticket items too if not careful
                            create: tickets.map((t: any) => {
                                const ticketItems = t.items?.map((i: any) => {
                                    const prodId = Number(i.productId);
                                    const typeId = Number(i.maintenanceTypeId);
                                    return {
                                        description: i.description || '',
                                        repairType: i.repairType,
                                        maintenanceTypeId: (!isNaN(typeId) && typeId > 0) ? typeId : undefined,
                                        productId: (!isNaN(prodId) && prodId > 0) ? prodId : undefined,
                                        cost: Number(i.cost) || 0,
                                        laborCost: Number(i.laborCost) || 0,
                                        hasIva: i.hasIva === true,
                                        affectedParts: Number(i.affectedParts) || 1
                                    };
                                }) || [];

                                const tCost = Number(t.cost) || ticketItems.reduce((acc, curr) => {
                                    let total = acc + curr.cost + curr.laborCost;
                                    if (curr.hasIva) total += (curr.cost + curr.laborCost) * 0.16;
                                    return total;
                                }, 0);

                                return {
                                    ticketNumber: t.ticketNumber,
                                    cost: tCost,
                                    items: {
                                        create: ticketItems
                                    }
                                };
                            })
                        }
                    })
                },
                include: { tickets: { include: { items: true } }, parts: true, evidence: true },
            });

            // If a scheduledId is provided, mark it as completed
            if (scheduledId) {
                await tx.scheduledMaintenance.update({
                    where: { id: +scheduledId },
                    data: { status: 'COMPLETED' },
                });
            }

            // Handle faults if provided
            if (resolvedFaultIds && resolvedFaultIds.length > 0) {
                await tx.fault.updateMany({
                    where: { id: { in: resolvedFaultIds } },
                    data: {
                        status: 'RESOLVED',
                        resolvedAt: new Date(),
                        maintenanceId: id
                    }
                });
            }

            return updated;
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
                maintenanceType: true,
                tickets: { include: { items: true } },
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
        targetVehicleId?: number;
    }) {
        // Si hay un vehículo destino, guardamos el log para ambos
        if (data.targetVehicleId) {
            await this.prisma.$transaction([
                this.prisma.partExchange.create({
                    data: {
                        vehicleId: data.vehicleId,
                        date: data.date,
                        productId: data.productId,
                        action: 'RETIRO',
                        description: `Canibalización para unidad: ${data.targetVehicleId}. ${data.description}`,
                    }
                }),
                this.prisma.partExchange.create({
                    data: {
                        vehicleId: data.targetVehicleId,
                        date: data.date,
                        productId: data.productId,
                        action: 'INSTALACION',
                        description: `Componente extraído de unidad: ${data.vehicleId}. ${data.description}`,
                    }
                })
            ]);
            return { message: 'Intercambio registrado entre ambas unidades' };
        }

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
