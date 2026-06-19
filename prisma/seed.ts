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

  // 5. Roles y Permisos
  console.log('Creando roles por defecto...');
  await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrador con acceso completo a todos los recursos y configuraciones.',
      permissions: {
        vehicles: { create: true, read: true, update: true, delete: true },
        users: { create: true, read: true, update: true, delete: true },
        catalogs: { create: true, read: true, update: true, delete: true },
        customerPanel: { read: true }
      }
    }
  });

  await prisma.role.upsert({
    where: { name: 'OPERATOR' },
    update: {},
    create: {
      name: 'OPERATOR',
      description: 'Operador del sistema con permisos básicos.',
      permissions: {
        vehicles: { create: false, read: true, update: true, delete: false },
        users: { create: false, read: false, update: false, delete: false },
        catalogs: { create: false, read: true, update: false, delete: false },
        customerPanel: { read: false }
      }
    }
  });

  await prisma.role.upsert({
    where: { name: 'CLIENTE' },
    update: {},
    create: {
      name: 'CLIENTE',
      description: 'Rol para visualización externa limitada a CEDIS asignados.',
      permissions: {
        vehicles: { create: false, read: false, update: false, delete: false },
        users: { create: false, read: false, update: false, delete: false },
        catalogs: { create: false, read: false, update: false, delete: false },
        customerPanel: { read: true }
      }
    }
  });
  console.log('- Roles ADMIN, OPERATOR y CLIENTE creados/verificados.');

  // 6. Tipos de Campo para Formulario Dinámico
  console.log('Creando tipos de campo por defecto...');
  const fieldTypes = [
    { name: 'TEXT', label: 'Texto Corto' },
    { name: 'LONGTEXT', label: 'Texto Largo' },
    { name: 'DATE', label: 'Fecha' },
    { name: 'IMAGE', label: 'Imagen' },
    { name: 'SIGNATURE', label: 'Firma Digital' },
    { name: 'CHECK', label: 'Casilla de Verificación (Check)' },
    { name: 'SELECT', label: 'Selección (Dropdown)' },
    { name: 'NUMBER', label: 'Valor Numérico' },
    { name: 'DOCUMENT', label: 'Documento / Archivo' }
  ];

  for (const ft of fieldTypes) {
    await prisma.fieldType.upsert({
      where: { name: ft.name },
      update: { label: ft.label },
      create: { name: ft.name, label: ft.label },
    });
  }
  console.log(`- ${fieldTypes.length} tipos de campo creados/verificados.`);

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
