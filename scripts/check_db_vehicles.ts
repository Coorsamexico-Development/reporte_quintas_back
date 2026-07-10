import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    try {
        const vehicles = await prisma.vehicle.findMany({
            include: {
                currentCedis: true
            }
        });
        console.log('Total Vehicles:', vehicles.length);
        console.log('Vehicles by CEDIS:');
        for (const v of vehicles) {
            console.log(`- Vehicle ID ${v.id}, Plate ${v.plate}, Status ${v.status}, CEDIS: ${v.currentCedisId} (${v.currentCedis?.name})`);
        }
        
        const logs = await prisma.maintenance.findMany();
        console.log('Total Maintenance Logs:', logs.length);
        if (logs.length > 0) {
            console.log('Sample Log:', JSON.stringify(logs[0]));
        }

        const sched = await prisma.scheduledMaintenance.findMany();
        console.log('Total Scheduled Maintenances:', sched.length);
        if (sched.length > 0) {
            console.log('Sample Scheduled:', JSON.stringify(sched[0]));
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
