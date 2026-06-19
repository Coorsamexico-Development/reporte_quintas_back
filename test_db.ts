import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const faults = await (prisma as any).fault.findMany();
    console.log(JSON.stringify(faults, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
