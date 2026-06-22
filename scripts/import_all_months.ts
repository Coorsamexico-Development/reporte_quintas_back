import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    const jsonPath = path.join(__dirname, 'all_months_data.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`No se encontró el archivo JSON: ${jsonPath}`);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`Leídos ${data.length} registros desde el JSON.`);

    console.log('Importando registros a la base de datos...');
    let importedCount = 0;
    
    for (const item of data) {
        const dateObj = new Date(`${item.date}T00:00:00.000Z`);
        
        await prisma.vehicleShiftAssignment.upsert({
            where: {
                date_shiftId_vehicleId: {
                    date: dateObj,
                    shiftId: item.shiftId,
                    vehicleId: item.vehicleId
                }
            },
            update: {
                status: item.status
            },
            create: {
                date: dateObj,
                shiftId: item.shiftId,
                vehicleId: item.vehicleId,
                status: item.status
            }
        });
        importedCount++;
    }

    console.log(`🎉 ¡Importación completada con éxito! Se procesaron ${importedCount} asignaciones.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
