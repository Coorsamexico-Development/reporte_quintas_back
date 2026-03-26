import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seeding de catálogos...');

  // 1. Marcas
  const brands = [
    'Kenworth',
    'Freightliner',
    'International',
    'Volvo',
    'Peterbilt',
    'Isuzu',
    'Hino',
    'Mercedes-Benz',
    'Scania',
    'Mack'
  ];

  for (const name of brands) {
    await prisma.vehicleBrand.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`- ${brands.length} marcas creadas/verificadas.`);

  // 2. Transmisiones
  const transmissions = [
    'Manual 10 Velocidades',
    'Manual 18 Velocidades',
    'Automática',
    'Automatizada (Allison)',
    'Automatizada (Eaton)'
  ];

  for (const name of transmissions) {
    await prisma.transmissionType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`- ${transmissions.length} tipos de transmisión creados/verificados.`);

  // 3. Combustibles
  const fuels = [
    'Diesel',
    'Gasolina',
    'Gas Natural Vehicular (GNV)',
    'Eléctrico',
    'Híbrido'
  ];

  for (const name of fuels) {
    await prisma.fuelType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`- ${fuels.length} tipos de combustible creados/verificados.`);

  // 4. Productos (Refacciones comunes)
  const products = [
    { name: 'Filtro de Aceite LF14000NN', code: 'P001', category: 'FILTROS', description: 'Cummins Engine Filter' },
    { name: 'Filtro de Aire Primario', code: 'P002', category: 'FILTROS', description: 'Main Air Filter' },
    { name: 'Aceite Motor 15W40 (Cubeta)', code: 'P003', category: 'LUBRICANTES', description: 'Heavy Duty Engine Oil' },
    { name: 'Balata Delantera Kit', code: 'P004', category: 'FRENOS', description: 'Front Brake Pad Kit' },
    { name: 'Tambor Trasero HD', code: 'P005', category: 'FRENOS', description: 'Heavy Duty Rear Drum' },
    { name: 'Anticongelante Rosa 50/50', code: 'P006', category: 'QUIMICOS', description: 'Coolant fluid' },
    { name: 'Llanta 295/80R22.5', code: 'P007', category: 'LLANTAS', description: 'Steer/Drive Tire' },
    { name: 'Faro LED Principal', code: 'P008', category: 'ELECTRICOS', description: 'Headlight assembly' }
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        name: p.name,
        code: p.code,
        category: p.category,
        description: p.description
      },
    });
  }
  console.log(`- ${products.length} productos/refacciones creados/verificados.`);

  console.log('Seeding completado con éxito.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
