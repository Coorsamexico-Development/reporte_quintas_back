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

    private async updateVehicleStatus(tx: any, vehicleId: number) {
        const openMaintenances = await tx.maintenance.count({
            where: { vehicleId, endDate: null }
        });

        await tx.vehicle.update({
            where: { id: vehicleId },
            data: { status: openMaintenances > 0 ? 'MAINTENANCE' : 'ACTIVE' }
        });
    }

    async createLog(data: any, files?: Express.Multer.File[], userId?: number) {
        let { evidenceUrls, tickets, parts, resolvedFaultIds, scheduledId, maintenanceTypeId, providerId, ...logData } = data;
        
        // Parse JSON strings from FormData if necessary
        try {
            if (typeof tickets === 'string') tickets = JSON.parse(tickets);
            if (typeof parts === 'string') parts = JSON.parse(parts);
            if (typeof resolvedFaultIds === 'string') resolvedFaultIds = JSON.parse(resolvedFaultIds);
        } catch (e) {
            console.error('Error parsing JSON from FormData:', e);
        }

        const vehicleId = Number(logData.vehicleId);
        if (isNaN(vehicleId)) {
            throw new Error('ID de vehículo inválido');
        }

        const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
        const truckNumber = vehicle?.truckNumber || 'unknown';

        if (files && files.length > 0) {
            const uploadedUrls = await Promise.all(
                files.map(file => this.storage.uploadFile(file, `unidades/${truckNumber}/mantenimientos`))
            );
            evidenceUrls = uploadedUrls;
        }
        
        const startDate = logData.date ? new Date(logData.date) : new Date();
        const endDate = logData.endDate ? new Date(logData.endDate) : null;
        
        let inactiveDays: number | null = null;
        let inactiveHours: number | null = null;

        if (endDate) {
            const diffMs = endDate.getTime() - startDate.getTime();
            if (diffMs > 0) {
                inactiveDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                inactiveHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
            }
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const log = await tx.maintenance.create({
                    data: {
                        vehicleId: vehicleId,
                        userId: userId ? Number(userId) : null,
                        providerId: providerId ? Number(providerId) : null,
                        type: logData.type || 'PREVENTIVE',
                        description: logData.description || '',
                        date: startDate,
                        endDate: endDate,
                        inactiveDays: inactiveDays,
                        inactiveHours: inactiveHours,
                        odometer: logData.odometer ? Number(logData.odometer) : null,
                        maintenanceTypeId: maintenanceTypeId ? +maintenanceTypeId : null,
                        scheduledMaintenanceId: (scheduledId && scheduledId !== 'null') ? +scheduledId : null,
                        evidence: {
                            create: (Array.isArray(evidenceUrls) ? evidenceUrls : []).map((url) => ({ url })),
                        },
                        tickets: {
                            create: tickets?.map(t => {
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

                // Update Vehicle Status based on open logs
                await this.updateVehicleStatus(tx, vehicleId);

                if (resolvedFaultIds && Array.isArray(resolvedFaultIds) && resolvedFaultIds.length > 0) {
                    await tx.fault.updateMany({
                        where: { id: { in: resolvedFaultIds.map(Number) } },
                        data: {
                            status: 'RESOLVED',
                            resolvedAt: new Date(),
                            maintenanceId: log.id
                        }
                    });
                }

                if (scheduledId && scheduledId !== 'null') {
                    await tx.scheduledMaintenance.update({
                        where: { id: +scheduledId },
                        data: { status: 'COMPLETED' }
                    });
                }

                const result = { ...log };
                if (result.evidence) {
                    result.evidence = await Promise.all(
                        result.evidence.map(async (e: any) => ({
                            ...e,
                            url: await this.storage.getViewUrl(e.url)
                        }))
                    );
                }
                return result;
            });
        } catch (error) {
            console.error('❌ Error in createLog transaction:', error);
            throw new InternalServerErrorException(error.message || 'Error al guardar el registro de mantenimiento');
        }
    }

    async updateLog(id: number, data: any, files?: Express.Multer.File[]) {
        let { scheduledId, evidenceUrls, tickets, parts, resolvedFaultIds, existingEvidence, maintenanceTypeId, providerId, ...rest } = data;
        
        // Parse JSON
        try {
            if (typeof tickets === 'string') tickets = JSON.parse(tickets);
            if (typeof existingEvidence === 'string') existingEvidence = JSON.parse(existingEvidence);
            if (typeof resolvedFaultIds === 'string') resolvedFaultIds = JSON.parse(resolvedFaultIds);
        } catch (e) {
            console.error('Error parsing JSON from FormData in updateLog:', e);
        }

        const log = await this.prisma.maintenance.findUnique({ where: { id }, include: { vehicle: true } });
        const truckNumber = log?.vehicle?.truckNumber || 'unknown';

        let finalEvidenceUrls = (Array.isArray(existingEvidence) ? existingEvidence : []).map((url: any) => {
            if (typeof url === 'string') return url.split('?')[0];
            if (url && typeof url.url === 'string') return url.url.split('?')[0];
            return url;
        });

        if (files && files.length > 0) {
            const uploadedUrls = await Promise.all(
                files.map(file => this.storage.uploadFile(file, `unidades/${truckNumber}/mantenimientos`))
            );
            finalEvidenceUrls = [...finalEvidenceUrls, ...uploadedUrls];
        }
        
        const startDate = rest.date ? new Date(rest.date) : (log?.date || new Date());
        const endDate = rest.endDate ? new Date(rest.endDate) : null;

        let inactiveDays: number | null = null;
        let inactiveHours: number | null = null;

        if (endDate) {
            const diffMs = endDate.getTime() - startDate.getTime();
            if (diffMs > 0) {
                inactiveDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                inactiveHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
            }
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                // Update the current maintenance log
                const updated = await tx.maintenance.update({
                    where: { id },
                    data: {
                        vehicleId: rest.vehicleId ? Number(rest.vehicleId) : undefined,
                        providerId: providerId ? Number(providerId) : undefined,
                        description: rest.description,
                        maintenanceTypeId: maintenanceTypeId ? +maintenanceTypeId : undefined,
                        scheduledMaintenanceId: (scheduledId && scheduledId !== 'null') ? +scheduledId : undefined,
                        odometer: rest.odometer ? Number(rest.odometer) : undefined,
                        date: startDate,
                        endDate: endDate,
                        inactiveDays: inactiveDays,
                        inactiveHours: inactiveHours,
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

                // Update Vehicle Status based on open logs
                const vId = rest.vehicleId ? Number(rest.vehicleId) : log?.vehicleId;
                if (vId) {
                    await this.updateVehicleStatus(tx, vId);
                }

                if (resolvedFaultIds && Array.isArray(resolvedFaultIds) && resolvedFaultIds.length > 0) {
                    await tx.fault.updateMany({
                        where: { id: { in: resolvedFaultIds.map(Number) } },
                        data: {
                            status: 'RESOLVED',
                            resolvedAt: new Date(),
                            maintenanceId: id
                        }
                    });
                }

                const result = { ...updated };
                if (result.evidence) {
                    result.evidence = await Promise.all(
                        result.evidence.map(async (e: any) => ({
                            ...e,
                            url: await this.storage.getViewUrl(e.url)
                        }))
                    );
                }
                return result;
            });
        } catch (error) {
            console.error('❌ Error in updateLog transaction:', error);
            throw new InternalServerErrorException(error.message || 'Error al actualizar el registro de mantenimiento');
        }
    }

    async deleteLog(id: number) {
        return this.prisma.$transaction(async (tx) => {
            const log = await tx.maintenance.findUnique({
                where: { id },
                include: { tickets: true, parts: true, evidence: true }
            });

            if (!log) throw new Error('Maintenance log not found');

            // Delete relations manually if needed (Prisma often handles this if onDelete: Cascade is set)
            // But let's be explicit for certainty
            await tx.maintenanceTicketItem.deleteMany({
                where: { ticket: { maintenanceId: id } }
            });
            await tx.maintenanceTicket.deleteMany({
                where: { maintenanceId: id }
            });
            await tx.maintenancePart.deleteMany({
                where: { maintenanceId: id }
            });
            await tx.maintenanceEvidence.deleteMany({
                where: { maintenanceId: id }
            });

            // Revert faults to pending if they were resolved by this log
            await tx.fault.updateMany({
                where: { maintenanceId: id },
                data: { status: 'PENDING', maintenanceId: null, resolvedAt: null }
            });

            const deleted = await tx.maintenance.delete({
                where: { id }
            });

            // Refresh vehicle status using the centralized logic
            await this.updateVehicleStatus(tx, log.vehicleId);

            return deleted;
        });
    }

    async getLogs(vehicleId?: number, providerId?: number) {
        const logs = await this.prisma.maintenance.findMany({
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

        // Sign URLs
        return Promise.all(logs.map(async (log) => {
            if (log.evidence) {
                log.evidence = await Promise.all(
                    log.evidence.map(async (e) => ({
                        ...e,
                        url: await this.storage.getViewUrl(e.url)
                    }))
                );
            }
            return log;
        }));
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
