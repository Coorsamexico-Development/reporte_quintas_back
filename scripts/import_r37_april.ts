import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Encontrar el vehículo R-37
    const vehicle = await prisma.vehicle.findFirst({
        where: {
            truckNumber: {
                contains: 'R-37'
            }
        }
    });

    if (!vehicle) {
        throw new Error('No se encontró el vehículo R-37 en la base de datos.');
    }
    console.log(`Vehículo encontrado: ID=${vehicle.id}, TruckNumber=${vehicle.truckNumber}, Plate=${vehicle.plate}`);

    // 2. Encontrar los turnos de GDL (CEDIS Guadalajara)
    // Busquemos todos los CEDIS primero para ver los nombres
    const allCedis = await prisma.cedis.findMany({
        include: {
            shifts: true
        }
    });

    console.log("CEDIS disponibles en la BD:", allCedis.map(c => `ID=${c.id} Name=${c.name}`));

    const cedis = allCedis.find(c => c.name.toLowerCase().includes('guadalajara') || c.name.toLowerCase().includes('gdl'));

    if (!cedis) {
        throw new Error('No se encontró el CEDIS Guadalajara en la lista.');
    }
    console.log(`CEDIS seleccionado: ID=${cedis.id}, Name=${cedis.name}`);
    console.log('Turnos asociados:', cedis.shifts.map(s => `ID=${s.id} Name=${s.name}`));

    const shifts = cedis.shifts.filter(s => s.isActive);
    if (shifts.length === 0) {
        throw new Error('No se encontraron turnos activos para el CEDIS Guadalajara.');
    }

    // 3. Crear registros para todo abril (1 al 30 de abril de 2026)
    console.log('\nGenerando registros de asistencia para R-37 (Operativa -> OPERATIONAL)...');
    let insertedCount = 0;

    for (let day = 1; day <= 30; day++) {
        const dateStr = `2026-04-${String(day).padStart(2, '0')}`;
        const dateObj = new Date(`${dateStr}T00:00:00.000Z`);

        for (const shift of shifts) {
            await prisma.vehicleShiftAssignment.upsert({
                where: {
                    date_shiftId_vehicleId: {
                        date: dateObj,
                        shiftId: shift.id,
                        vehicleId: vehicle.id
                    }
                },
                update: {
                    status: 'OPERATIONAL' // R-37 era operativa
                },
                create: {
                    date: dateObj,
                    shiftId: shift.id,
                    vehicleId: vehicle.id,
                    status: 'OPERATIONAL'
                }
            });
            insertedCount++;
        }
    }

    console.log(`\n🎉 ¡Proceso completado! Se insertaron/actualizaron ${insertedCount} registros de asistencia para R-37 en abril de 2026.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
