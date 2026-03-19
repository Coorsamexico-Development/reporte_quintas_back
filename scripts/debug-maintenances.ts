import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const maintenances = await prisma.maintenance.findMany({
    include: {
      vehicle: true
    }
  });

  console.log('--- All Maintenances ---');
  maintenances.forEach(m => {
    console.log(`ID: ${m.id}, Vehicle: ${m.vehicle?.truckNumber} (ID: ${m.vehicleId}), Desc: ${m.description}, Status: ${m.status}`);
  });

  console.log('\n--- Filtering for Vehicle ID 1 ---');
  const forV1 = await prisma.maintenance.findMany({
    where: { vehicleId: 1 }
  });
  console.log('Count for V1:', forV1.length);

  console.log('\n--- Filtering for Vehicle ID 2 ---');
  const forV2 = await prisma.maintenance.findMany({
    where: { vehicleId: 2 }
  });
  console.log('Count for V2:', forV2.length);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
