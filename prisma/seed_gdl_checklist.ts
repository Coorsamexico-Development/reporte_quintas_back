import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Sembrando checklist dinámico de GDL...');

  // 1. Buscar CEDIS de GDL (ID=2 o nombre GDL)
  const gdlCedis = await prisma.cedis.findFirst({
    where: {
      OR: [
        { id: 2 },
        { name: { startsWith: 'GDL' } }
      ]
    }
  });

  if (!gdlCedis) {
    console.error('ERROR: No se encontró el CEDIS GDL.');
    return;
  }

  console.log(`CEDIS encontrado: ${gdlCedis.name} (ID: ${gdlCedis.id})`);

  // 2. Obtener mapa de tipos de campo
  const fieldTypes = await prisma.fieldType.findMany();
  const typeMap = new Map<string, number>();
  for (const ft of fieldTypes) {
    typeMap.set(ft.name, ft.id);
  }

  const checkTypeId = typeMap.get('CHECK');
  const numberTypeId = typeMap.get('NUMBER');
  const selectTypeId = typeMap.get('SELECT');
  const longtextTypeId = typeMap.get('LONGTEXT');
  const signatureTypeId = typeMap.get('SIGNATURE');

  if (!checkTypeId || !numberTypeId || !selectTypeId || !longtextTypeId || !signatureTypeId) {
    console.error('ERROR: Tipos de campo no sembrados en la base de datos.');
    return;
  }

  // 3. Crear o actualizar el CedisForm para GDL
  const form = await prisma.cedisForm.upsert({
    where: { cedisId: gdlCedis.id },
    update: {},
    create: {
      cedisId: gdlCedis.id,
      title: 'Checklist de Inspección Diaria (GDL)'
    }
  });

  // Limpiar campos existentes del formulario para evitar duplicados
  await prisma.cedisFormField.deleteMany({
    where: { formId: form.id }
  });

  // 4. Preguntas del formulario a sembrar
  const fieldsToSeed = [
    // --- CABECERA (HEADER) ---
    {
      label: 'Horómetro',
      section: 'DATOS GENERALES',
      fieldTypeId: numberTypeId,
      docSection: 'HEADER',
      columnNumber: 3,
      isRequired: true,
      options: null
    },
    {
      label: 'Nivel de gasolina',
      section: 'DATOS GENERALES',
      fieldTypeId: selectTypeId,
      docSection: 'HEADER',
      columnNumber: 3,
      isRequired: true,
      options: JSON.stringify(['E (Vacío)', '1/4', '1/2', '3/4', 'F (Lleno)'])
    },

    // --- CUERPO (BODY) - COLUMNA 1 ---
    {
      label: 'Presión',
      section: 'Sistema de compresión',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Fugas',
      section: 'Sistema de compresión',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Luces (general)',
      section: 'Sistema eléctrico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Claxon',
      section: 'Sistema eléctrico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Marcha',
      section: 'Sistema eléctrico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Switch',
      section: 'Sistema eléctrico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Batería',
      section: 'Sistema eléctrico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 1,
      isRequired: false,
      options: null
    },

    // --- CUERPO (BODY) - COLUMNA 2 ---
    {
      label: 'Alarma de reversa',
      section: 'Sistema de seguridad',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Espejos',
      section: 'Sistema de seguridad',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Cinturón',
      section: 'Sistema de seguridad',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Extintor',
      section: 'Sistema de seguridad',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Presión',
      section: 'Llantas',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Desgaste',
      section: 'Llantas',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },
    {
      label: 'Tornillería',
      section: 'Llantas',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 2,
      isRequired: false,
      options: null
    },

    // --- CUERPO (BODY) - COLUMNA 3 ---
    {
      label: 'Nivel de aceite',
      section: 'Motor',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Fugas',
      section: 'Motor',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Refrigerante',
      section: 'Motor',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Mangueras',
      section: 'Sistema hidráulico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Fugas',
      section: 'Sistema hidráulico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Pistones',
      section: 'Sistema hidráulico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },
    {
      label: 'Nivel de aceite',
      section: 'Sistema hidráulico',
      fieldTypeId: checkTypeId,
      docSection: 'BODY',
      columnNumber: 3,
      isRequired: false,
      options: null
    },

    // --- PIE DE PÁGINA (FOOTER) ---
    {
      label: 'Comentarios',
      section: 'COMENTARIOS',
      fieldTypeId: longtextTypeId,
      docSection: 'FOOTER',
      columnNumber: 1,
      isRequired: false,
      options: null
    },
    {
      label: 'Supervisor',
      section: 'FIRMA',
      fieldTypeId: signatureTypeId,
      docSection: 'FOOTER',
      columnNumber: 1,
      isRequired: true,
      options: null
    },
    {
      label: 'Validación',
      section: 'VALIDACIÓN',
      fieldTypeId: selectTypeId,
      docSection: 'FOOTER',
      columnNumber: 1,
      isRequired: true,
      options: JSON.stringify(['OPERATIVA', 'NO OPERATIVA'])
    }
  ];

  // Crear campos con orden incremental
  let index = 0;
  for (const f of fieldsToSeed) {
    await prisma.cedisFormField.create({
      data: {
        formId: form.id,
        label: f.label,
        section: f.section,
        fieldTypeId: f.fieldTypeId,
        docSection: f.docSection,
        columnNumber: f.columnNumber,
        isRequired: f.isRequired,
        options: f.options,
        order: index++
      }
    });
  }

  console.log(`Checklist dinámico de GDL sembrado con éxito. ${fieldsToSeed.length} campos creados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
