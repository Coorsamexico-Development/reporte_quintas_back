import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
    await prisma.maintenanceType.deleteMany({
        where: {
            name: {
                in: ['PREVENTIVA', 'CORRECTIVA']
            }
        }
    });
    console.log('Cleaned old types');
}

clean().finally(() => prisma.$disconnect());
