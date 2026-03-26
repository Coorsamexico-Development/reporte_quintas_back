import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cedis = await prisma.cedis.findMany();
    console.log(JSON.stringify(cedis, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
