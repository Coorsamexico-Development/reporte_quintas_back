import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const start = new Date('2026-04-01T00:00:00.000Z');
    const end = new Date('2026-04-30T23:59:59.000Z');

    const assignments = await prisma.vehicleShiftAssignment.findMany({
        where: {
            date: {
                gte: start,
                lte: end
            }
        },
        include: {
            vehicle: true,
            shift: true
        }
    });

    console.log(`Total assignments in database for April: ${assignments.length}`);

    const stats: Record<string, Record<string, number>> = {};
    for (const a of assignments) {
        const truckNum = a.vehicle.truckNumber;
        const status = a.status;
        const shiftName = a.shift.name;
        
        const key = `${truckNum} (${shiftName})`;
        if (!stats[key]) {
            stats[key] = { OPERATIONAL: 0, AVAILABLE: 0, BACKUP: 0 };
        }
        stats[key][status]++;
    }

    console.log('\nAssignments per vehicle and shift in April:');
    for (const [key, counts] of Object.entries(stats).sort()) {
        console.log(`  ${key}:`, counts);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
