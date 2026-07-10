import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async getExpenses() {
        const [maintenances, exchanges] = await Promise.all([
            this.prisma.maintenance.findMany({
                include: {
                    vehicle: {
                        include: { currentCedis: true }
                    },
                    tickets: { include: { items: true } },
                    parts: true
                }
            }),
            this.prisma.partExchange.findMany({
                where: { isActive: true, cost: { gt: 0 } },
                include: {
                    vehicle: {
                        include: { currentCedis: true }
                    }
                }
            })
        ]);

        const expenses: any[] = [];

        // Agrupar y Calcular
        for (const m of maintenances) {
            const date = new Date(m.date);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cedisName = m.vehicle?.currentCedis?.name || 'CEDIS Desconocido';
            const type = m.scheduledMaintenanceId ? 'PREVENTIVE' : 'CORRECTIVE';

            let totalCost = 0;
            // Sumar tickets e items
            for (const ticket of m.tickets) {
                if (ticket.items && ticket.items.length > 0) {
                    for (const item of ticket.items) {
                        const itemParts = Number(item.cost) || 0;
                        const itemLabor = Number(item.laborCost) || 0;
                        const itemIva = item.hasIva ? (itemParts + itemLabor) * 0.16 : 0;
                        totalCost += itemParts + itemLabor + itemIva;
                    }
                } else {
                    totalCost += Number(ticket.cost || 0);
                }
            }
            // Sumar partes de inventario
            for (const part of m.parts) {
                totalCost += (Number(part.unitCost || 0) * part.quantity);
            }

            expenses.push({
                id: m.id,
                month,
                cedis: cedisName,
                type,
                cost: totalCost
            });
        }

        // Agrupar y Calcular para canibalizaciones
        for (const ex of exchanges) {
            const date = new Date(ex.date);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cedisName = ex.vehicle?.currentCedis?.name || 'CEDIS Desconocido';
            const costSign = ex.action === 'RETIRO' ? -1 : 1;
            const costVal = Number(ex.cost) || 0;

            expenses.push({
                id: `ex-${ex.id}`,
                month,
                cedis: cedisName,
                type: 'CORRECTIVE', // Se contabiliza bajo correctivo
                cost: costVal * costSign
            });
        }

        // Aggregate by [Month] -> [Cedis] -> [Type]
        const aggregation: Record<string, any> = {};

        for (const exp of expenses) {
            if (!aggregation[exp.month]) {
                aggregation[exp.month] = {};
            }
            if (!aggregation[exp.month][exp.cedis]) {
                aggregation[exp.month][exp.cedis] = {
                    PREVENTIVE: 0,
                    CORRECTIVE: 0,
                    TOTAL: 0
                };
            }

            aggregation[exp.month][exp.cedis][exp.type] += exp.cost;
            aggregation[exp.month][exp.cedis].TOTAL += exp.cost;
        }

        return {
            raw: expenses,
            aggregated: aggregation
        };
    }

    async getRecentActivity() {
        const [maintenances, movements, faults, exchanges] = await Promise.all([
            this.prisma.maintenance.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: { vehicle: true }
            }),
            this.prisma.vehicleMovement.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: { vehicle: true, fromCedis: true, toCedis: true }
            }),
            this.prisma.fault.findMany({
                take: 10,
                orderBy: { reportedAt: 'desc' },
                include: { vehicle: true }
            }),
            this.prisma.partExchange.findMany({
                take: 10,
                orderBy: { date: 'desc' },
                include: { vehicle: true, product: true }
            })
        ]);

        const events = [
            ...maintenances.map(m => ({
                type: 'Mantenimiento',
                date: m.date,
                vehicleName: `${m.vehicle.truckNumber} (${m.vehicle.plate})`,
                description: m.description,
                timestamp: new Date(m.date).getTime()
            })),
            ...movements.map(mov => ({
                type: 'Movimiento',
                date: mov.date,
                vehicleName: `${mov.vehicle.truckNumber} (${mov.vehicle.plate})`,
                description: `Traslado a ${mov.toCedis.name}`,
                timestamp: new Date(mov.date).getTime()
            })),
            ...faults.map(f => ({
                type: 'Falla Reportada',
                date: f.reportedAt,
                vehicleName: `${f.vehicle.truckNumber} (${f.vehicle.plate})`,
                description: f.title,
                timestamp: new Date(f.reportedAt).getTime()
            })),
            ...exchanges.map(ex => ({
                type: 'Canibalización',
                date: ex.date,
                vehicleName: `${ex.vehicle.truckNumber} (${ex.vehicle.plate})`,
                description: `${ex.action === 'REMOVED' ? 'Retiro' : 'Instalación'} de ${ex.product.name}`,
                timestamp: new Date(ex.date).getTime()
            }))
        ];

        return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
    }

    async getGlobalSummary() {
        const [scheduled, maintenances, vehicles, faults, exchanges] = await Promise.all([
            this.prisma.scheduledMaintenance.findMany(),
            this.prisma.maintenance.findMany({
                include: { tickets: { include: { items: true } }, parts: true }
            }),
            this.prisma.vehicle.findMany(),
            this.prisma.fault.findMany(),
            this.prisma.partExchange.findMany({
                where: { isActive: true }
            })
        ]);

        // Compliance
        const totalScheduled = scheduled.length;
        const totalCompleted = scheduled.filter(s => s.status === 'COMPLETED').length;
        const complianceRate = totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0;

        const monthlyCompliance: Record<string, any> = {};
        scheduled.forEach(s => {
            const mKey = new Date(s.date).toISOString().slice(0, 7);
            if (!monthlyCompliance[mKey]) monthlyCompliance[mKey] = { total: 0, completed: 0 };
            monthlyCompliance[mKey].total++;
            if (s.status === 'COMPLETED') monthlyCompliance[mKey].completed++;
        });

        // Cost Breakdown
        let totalLabor = 0;
        let totalParts = 0;
        let totalExtra = 0;

        const monthlyExpenses: Record<string, any> = {};

        maintenances.forEach(m => {
            let mTotal = 0;
            m.tickets.forEach(t => {
                t.items.forEach(i => {
                    const labor = Number(i.laborCost) || 0;
                    const parts = Number(i.cost) || 0;
                    const iva = i.hasIva ? (labor + parts) * 0.16 : 0;
                    totalLabor += labor;
                    totalParts += parts;
                    totalExtra += iva;
                    mTotal += labor + parts + iva;
                });
            });
            m.parts.forEach(p => {
                const pCost = (Number(p.unitCost) || 0) * p.quantity;
                totalParts += pCost;
                mTotal += pCost;
            });

            const mKey = new Date(m.date).toISOString().slice(0, 7);
            if (!monthlyExpenses[mKey]) monthlyExpenses[mKey] = { preventive: 0, corrective: 0, preventiveCount: 0, correctiveCount: 0 };
            if (m.scheduledMaintenanceId) {
                monthlyExpenses[mKey].preventive += mTotal;
                monthlyExpenses[mKey].preventiveCount++;
            } else {
                monthlyExpenses[mKey].corrective += mTotal;
                monthlyExpenses[mKey].correctiveCount++;
            }
        });

        // Add exchanges to parts costs and monthly breakdown
        exchanges.forEach(ex => {
            const costVal = Number(ex.cost) || 0;
            if (costVal > 0) {
                const costSign = ex.action === 'RETIRO' ? -1 : 1;
                const valueChange = costVal * costSign;
                totalParts += valueChange;

                const mKey = new Date(ex.date).toISOString().slice(0, 7);
                if (!monthlyExpenses[mKey]) monthlyExpenses[mKey] = { preventive: 0, corrective: 0, preventiveCount: 0, correctiveCount: 0 };
                monthlyExpenses[mKey].corrective += valueChange;
            }
        });

        // Stats by Unit (Faults and Cost)
        const vehicleStats: Record<number, { faultCount: number, cost: number }> = {};
        vehicles.forEach(v => {
            vehicleStats[v.id] = { faultCount: 0, cost: 0 };
        });

        faults.forEach(f => {
            if (vehicleStats[f.vehicleId]) {
                vehicleStats[f.vehicleId].faultCount++;
            }
        });

        maintenances.forEach(m => {
            let mTotal = 0;
            m.tickets.forEach(t => {
                t.items.forEach(i => {
                    const labor = Number(i.laborCost) || 0;
                    const parts = Number(i.cost) || 0;
                    const iva = i.hasIva ? (labor + parts) * 0.16 : 0;
                    mTotal += labor + parts + iva;
                });
            });
            m.parts.forEach(p => {
                mTotal += (Number(p.unitCost) || 0) * p.quantity;
            });
            if (vehicleStats[m.vehicleId]) {
                vehicleStats[m.vehicleId].cost += mTotal;
            }
        });

        exchanges.forEach(ex => {
            const costVal = Number(ex.cost) || 0;
            if (costVal > 0) {
                const costSign = ex.action === 'RETIRO' ? -1 : 1;
                const valueChange = costVal * costSign;
                if (vehicleStats[ex.vehicleId]) {
                    vehicleStats[ex.vehicleId].cost += valueChange;
                }
            }
        });

        const topFaultyUnits = vehicles
            .map(v => ({
                id: v.id,
                truckNumber: v.truckNumber,
                faultCount: vehicleStats[v.id]?.faultCount || 0,
                cost: vehicleStats[v.id]?.cost || 0
            }))
            .filter(v => v.faultCount > 0 || v.cost > 0)
            .sort((a, b) => b.faultCount - a.faultCount || b.cost - a.cost)
            .slice(0, 5);

        return {
            compliance: {
                total: totalScheduled,
                completed: totalCompleted,
                rate: complianceRate,
                monthly: monthlyCompliance
            },
            costs: {
                labor: totalLabor,
                parts: totalParts,
                extra: totalExtra,
                total: totalLabor + totalParts + totalExtra,
                monthly: monthlyExpenses
            },
            topFaultyUnits
        };
    }

    async getOperationalTrends(cedisId?: number) {
        try {
            const now = new Date();
            // Get yesterday (hoy - 1 dia)
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const yyyy = yesterday.getFullYear();
            const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
            const dd = String(yesterday.getDate()).padStart(2, '0');
            const fechaFin = `${yyyy}-${mm}-${dd}`;
            const fechaInicio = `${yyyy}-01-01`;

            // Default to GDL (120 / local ID 2)
            let targetCeco = 120;
            let localName = 'GDL ';
            let localId = 2;

            if (cedisId === 1) {
                targetCeco = 202;
                localName = 'CDU';
                localId = 1;
            }

            console.log(`[Trends] Fetching CECO ${targetCeco} for local CEDIS ${localId} from ${fechaInicio} to ${fechaFin}...`);

            const url = 'https://coorsamexico-operaciones-401457559403.us-central1.run.app/api/v1/turnos/get/by/ceco/rango';
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cecoId: targetCeco,
                    fechaInicio,
                    fechaFin
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch from external API for CECO ${targetCeco}: ${response.statusText}`);
            }

            const data = await response.json();
            const cecoData = data.ceco || {};
            const turnos = cecoData.turnos || [];

            const trends: any[] = [];

            for (const t of turnos) {
                const shiftName = t.name;
                const dias = t.turno_dias || [];
                for (const d of dias) {
                    const date = d.fecha_turno;
                    const commitment = d.capacidad || 0;

                    let operational = 0;
                    const ctrl = d.control_asistencias;
                    if (ctrl) {
                        if (Array.isArray(ctrl)) {
                            for (const item of ctrl) {
                                if (item.activo !== 0) {
                                    operational += item.asistencias || 0;
                                }
                            }
                        } else if (typeof ctrl === 'object') {
                            if (ctrl.activo !== 0) {
                                operational = ctrl.asistencias || 0;
                            }
                        }
                    }

                    trends.push({
                        date,
                        shiftName,
                        cedisName: localName,
                        cedisId: localId,
                        operational,
                        available: 0,
                        backup: 0,
                        commitment
                    });
                }
            }

            console.log(`[Trends] Mapped ${trends.length} daily trends from CECO ${targetCeco}.`);
            return trends;
        } catch (error) {
            console.error('Error fetching operational trends:', error);
            return [];
        }
    }
}
