import { PrismaService } from '../src/prisma/prisma.service';
import { AnalyticsService } from '../src/analytics/analytics.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);

async function main() {
    console.log('--- Iniciando prueba de compromisos dinámicos ---');

    // 1. Obtener el CEDIS GDL
    const gdlCedis = await prisma.cedis.findFirst({
        where: { name: { startsWith: 'GDL' } },
        include: { shifts: true }
    });

    if (!gdlCedis) {
        throw new Error('No se encontró el CEDIS de GDL.');
    }
    console.log(`Encontrado CEDIS: ${gdlCedis.name} (ID: ${gdlCedis.id})`);

    // 2. Obtener turnos
    const matutino = gdlCedis.shifts.find(s => s.name === 'Matutino');
    const nocturno = gdlCedis.shifts.find(s => s.name === 'Nocturno');

    if (!matutino || !nocturno) {
        throw new Error('No se encontraron los turnos Matutino y Nocturno para GDL.');
    }
    console.log(`Turno Matutino ID: ${matutino.id}, Turno Nocturno ID: ${nocturno.id}`);

    // 3. Obtener un vehículo cualquiera para asociar en la asignación
    const vehicle = await prisma.vehicle.findFirst();
    if (!vehicle) {
        throw new Error('No se encontró ningún vehículo en la base de datos para la prueba.');
    }
    console.log(`Usando vehículo ID: ${vehicle.id} (${vehicle.truckNumber}) para asignaciones temporales.`);

    // 4. Fechas clave a probar y sus compromisos esperados
    const testCases = [
        { dateStr: '2026-01-15', expected: 8 },
        { dateStr: '2026-03-05', expected: 8 },
        { dateStr: '2026-03-20', expected: 7 },
        { dateStr: '2026-04-15', expected: 7 },
        { dateStr: '2026-05-10', expected: 7 },
        { dateStr: '2026-05-28', expected: 9 },
    ];

    // Limpiar posibles registros previos de la prueba
    const dates = testCases.map(tc => new Date(`${tc.dateStr}T00:00:00.000Z`));
    await prisma.vehicleShiftAssignment.deleteMany({
        where: {
            shiftId: { in: [matutino.id, nocturno.id] },
            date: { in: dates }
        }
    });

    // 5. Insertar asignaciones temporales
    console.log('Insertando asignaciones de prueba...');
    for (const tc of testCases) {
        const date = new Date(`${tc.dateStr}T00:00:00.000Z`);
        
        // Asignación Matutino
        await prisma.vehicleShiftAssignment.create({
            data: {
                date,
                shiftId: matutino.id,
                vehicleId: vehicle.id,
                status: 'OPERATIONAL'
            }
        });

        // Asignación Nocturno
        await prisma.vehicleShiftAssignment.create({
            data: {
                date,
                shiftId: nocturno.id,
                vehicleId: vehicle.id,
                status: 'OPERATIONAL'
            }
        });
    }

    // 6. Obtener tendencias operativas
    console.log('Consultando getOperationalTrends desde AnalyticsService...');
    const trends = await analytics.getOperationalTrends();

    // 7. Validar resultados
    let failures = 0;
    for (const tc of testCases) {
        // Buscar el registro matutino
        const trendMatutino = trends.find(t => t.date === tc.dateStr && t.shiftName === 'Matutino' && t.cedisId === gdlCedis.id);
        // Buscar el registro nocturno
        const trendNocturno = trends.find(t => t.date === tc.dateStr && t.shiftName === 'Nocturno' && t.cedisId === gdlCedis.id);

        if (!trendMatutino) {
            console.error(`❌ [Matutino] No se encontró tendencia para la fecha ${tc.dateStr}`);
            failures++;
        } else if (trendMatutino.commitment !== tc.expected) {
            console.error(`❌ [Matutino] Para la fecha ${tc.dateStr} se esperaba compromiso ${tc.expected}, pero se obtuvo ${trendMatutino.commitment}`);
            failures++;
        } else {
            console.log(`✅ [Matutino] Fecha ${tc.dateStr}: compromiso ${trendMatutino.commitment} (Esperado: ${tc.expected})`);
        }

        if (!trendNocturno) {
            console.error(`❌ [Nocturno] No se encontró tendencia para la fecha ${tc.dateStr}`);
            failures++;
        } else if (trendNocturno.commitment !== tc.expected) {
            console.error(`❌ [Nocturno] Para la fecha ${tc.dateStr} se esperaba compromiso ${tc.expected}, pero se obtuvo ${trendNocturno.commitment}`);
            failures++;
        } else {
            console.log(`✅ [Nocturno] Fecha ${tc.dateStr}: compromiso ${trendNocturno.commitment} (Esperado: ${tc.expected})`);
        }
    }

    // 8. Limpiar asignaciones temporales
    console.log('Limpiando asignaciones temporales...');
    await prisma.vehicleShiftAssignment.deleteMany({
        where: {
            shiftId: { in: [matutino.id, nocturno.id] },
            date: { in: dates }
        }
    });

    if (failures === 0) {
        console.log('\n🎉 ¡TODAS LAS PRUEBAS PASARON CORRECTAMENTE! El historial dinámico de compromisos funciona a la perfección.');
    } else {
        console.error(`\n❌ Se encontraron ${failures} fallos en la validación.`);
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
