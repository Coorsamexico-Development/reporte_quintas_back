import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cedis = await prisma.cedis.findMany({
    include: {
      shifts: true,
    },
  });
  console.log(JSON.stringify(cedis, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
