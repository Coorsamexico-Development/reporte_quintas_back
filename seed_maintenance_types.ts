import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const types = ['MECÁNICO', 'ELÉCTRICO', 'HIDRÁULICO', 'CARROCERÍA', 'LLANTAS'];
  for (const name of types) {
    await prisma.maintenanceType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('Seeded Maintenance Types');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
