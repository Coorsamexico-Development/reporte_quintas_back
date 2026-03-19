
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cedis = await prisma.cedis.findMany({
    include: {
      _count: {
        select: { currentVehicles: true }
      }
    }
  });

  console.log('--- CEDIS IN DATABASE ---');
  cedis.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Vehicles: ${c._count.currentVehicles}`);
  });
  console.log('-------------------------');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
