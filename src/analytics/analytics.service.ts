import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async getExpenses() {
        const maintenances = await this.prisma.maintenance.findMany({
            include: {
                vehicle: {
                    include: { currentCedis: true }
                },
                tickets: true,
                parts: true
            }
        });

        const expenses: any[] = [];

        // Agrupar y Calcular
        for (const m of maintenances) {
            const date = new Date(m.date);
            const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const cedisName = m.vehicle?.currentCedis?.name || 'CEDIS Desconocido';
            const type = m.type;

            let totalCost = 0;
            // Sumar tickets
            for (const ticket of m.tickets) {
                totalCost += Number(ticket.cost || 0);
            }
            // Sumar partes
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
}
