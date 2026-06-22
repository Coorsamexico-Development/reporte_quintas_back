import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const cedis = await prisma.cedis.findFirst({
        where: { name: { startsWith: 'GDL' } }
    });

    if (!cedis) {
        console.error('No se encontró el CEDIS GDL.');
        return;
    }

    const form = await prisma.cedisForm.findUnique({
        where: { cedisId: cedis.id },
        include: {
            fields: {
                include: { fieldType: true },
                orderBy: { order: 'asc' }
            }
        }
    });

    if (!form) {
        console.log(`No hay formulario registrado para el CEDIS GDL (ID=${cedis.id}).`);
        return;
    }

    console.log(`Formulario: ID=${form.id}, Title=${form.title}`);
    console.log(`Campos encontrados (${form.fields.length}):`);
    for (const f of form.fields) {
        console.log(`  - ID=${f.id}, Label="${f.label}", Section="${f.section}", Type=${f.fieldType.name}, Order=${f.order}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
