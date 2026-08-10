// migrate_inventory_movement_types.mjs
// Aplica prisma/migrations/20260810120000_inventory_movement_type_catalog
// contra la BD conectada por DATABASE_URL (via proxy 127.0.0.1:3307 a
// produccion). Reemplaza el enum InventoryStartType por catalogos
// relacionales (InventoryMovementCategory / InventoryMovementType).

import { createConnection } from 'mysql2/promise';

const conn = await createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: "P],l{e)0s`l/MM<$",
  database: 'reporte_quintas',
  multipleStatements: false,
});

console.log('🔌 Conectado a la BD (proxy 127.0.0.1:3307).');

async function run(sql, label) {
  console.log(`▶ ${label}`);
  await conn.query(sql);
}

try {
  await run(`
    CREATE TABLE IF NOT EXISTS \`InventoryMovementCategory\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(191) NOT NULL,
      \`label\` VARCHAR(191) NOT NULL,
      \`sign\` INTEGER NOT NULL,
      \`isActive\` BOOLEAN NOT NULL DEFAULT true,
      \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`InventoryMovementCategory_name_key\` (\`name\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'Crear InventoryMovementCategory');

  await run(`
    CREATE TABLE IF NOT EXISTS \`InventoryMovementType\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(191) NOT NULL,
      \`label\` VARCHAR(191) NOT NULL,
      \`categoryId\` INTEGER NOT NULL,
      \`isWriteOff\` BOOLEAN NOT NULL DEFAULT false,
      \`isActive\` BOOLEAN NOT NULL DEFAULT true,
      \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`),
      UNIQUE INDEX \`InventoryMovementType_name_key\` (\`name\`),
      INDEX \`InventoryMovementType_categoryId_fkey\` (\`categoryId\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `, 'Crear InventoryMovementType');

  // FK: idempotente (si ya existe, MySQL truena; lo checamos antes)
  const [fks] = await conn.query(`
    SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'reporte_quintas' AND TABLE_NAME = 'InventoryMovementType'
      AND CONSTRAINT_NAME = 'InventoryMovementType_categoryId_fkey'
  `);
  if (fks.length === 0) {
    await run(`
      ALTER TABLE \`InventoryMovementType\`
        ADD CONSTRAINT \`InventoryMovementType_categoryId_fkey\`
        FOREIGN KEY (\`categoryId\`) REFERENCES \`InventoryMovementCategory\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
    `, 'FK InventoryMovementType -> InventoryMovementCategory');
  } else {
    console.log('  (FK ya existe, se omite)');
  }

  const [existingCats] = await conn.query(`SELECT COUNT(*) as c FROM InventoryMovementCategory`);
  if (existingCats[0].c === 0) {
    await run(`
      INSERT INTO \`InventoryMovementCategory\` (\`name\`, \`label\`, \`sign\`, \`sortOrder\`) VALUES
        ('INCOME', 'Ingresos (+)', 1, 1),
        ('EXPENSE', 'Salidas / Bajas (-)', -1, 2);
    `, 'Seed categorias');
  } else {
    console.log('▶ Categorias ya sembradas, se omite seed');
  }

  const [existingTypes] = await conn.query(`SELECT COUNT(*) as c FROM InventoryMovementType`);
  if (existingTypes[0].c === 0) {
    const seeds = [
      ['PURCHASE', 'Compra Nueva (Facturada)', 'INCOME', false, 1],
      ['TRANSFER_IN', 'Entrada por Traspaso', 'INCOME', false, 2],
      ['ADJUSTMENT', 'Ajuste / Recuperado', 'INCOME', false, 3],
      ['USAGE', 'Asignación / Entrega', 'EXPENSE', false, 1],
      ['LOSS', 'Reporte de Extravío', 'EXPENSE', true, 2],
      ['BREAKAGE', 'Reporte de Rotura/Desgaste', 'EXPENSE', true, 3],
      ['TRANSFER_OUT', 'Salida por Traspaso', 'EXPENSE', false, 4],
    ];
    for (const [name, label, catName, isWriteOff, sortOrder] of seeds) {
      await conn.query(
        `INSERT INTO InventoryMovementType (name, label, categoryId, isWriteOff, sortOrder)
         SELECT ?, ?, id, ?, ? FROM InventoryMovementCategory WHERE name = ?`,
        [name, label, isWriteOff, sortOrder, catName]
      );
    }
    console.log('▶ Seed tipos de movimiento (7 tipos)');
  } else {
    console.log('▶ Tipos de movimiento ya sembrados, se omite seed');
  }

  // Columna movementTypeId (nullable primero, para poder backfillear)
  const [cols] = await conn.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'reporte_quintas' AND TABLE_NAME = 'InventoryMovement' AND COLUMN_NAME = 'movementTypeId'
  `);
  if (cols.length === 0) {
    await run(`ALTER TABLE \`InventoryMovement\` ADD COLUMN \`movementTypeId\` INTEGER NULL;`, 'Agregar columna movementTypeId (nullable)');
  } else {
    console.log('▶ Columna movementTypeId ya existe, se omite ADD COLUMN');
  }

  // ¿La columna vieja `type` todavia existe? (para saber si toca backfillear)
  const [oldTypeCol] = await conn.query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'reporte_quintas' AND TABLE_NAME = 'InventoryMovement' AND COLUMN_NAME = 'type'
  `);

  if (oldTypeCol.length > 0) {
    await run(`
      UPDATE InventoryMovement m
      JOIN InventoryMovementType t ON t.name = m.type
      SET m.movementTypeId = t.id
      WHERE m.movementTypeId IS NULL;
    `, 'Backfill movementTypeId desde la columna type vieja');

    const [orphans] = await conn.query(`SELECT COUNT(*) as c FROM InventoryMovement WHERE movementTypeId IS NULL`);
    if (orphans[0].c > 0) {
      throw new Error(`ABORTADO: quedaron ${orphans[0].c} movimientos sin mapear a un tipo del catalogo. Revisar valores de 'type' que no coincidan con los tipos sembrados antes de continuar.`);
    }
    console.log('✅ Backfill verificado: 0 filas huerfanas.');

    await run(`ALTER TABLE \`InventoryMovement\` MODIFY \`movementTypeId\` INTEGER NOT NULL;`, 'Endurecer movementTypeId a NOT NULL');

    const [fkExists] = await conn.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = 'reporte_quintas' AND TABLE_NAME = 'InventoryMovement'
        AND CONSTRAINT_NAME = 'InventoryMovement_movementTypeId_fkey'
    `);
    if (fkExists.length === 0) {
      await run(`
        ALTER TABLE \`InventoryMovement\`
          ADD CONSTRAINT \`InventoryMovement_movementTypeId_fkey\`
          FOREIGN KEY (\`movementTypeId\`) REFERENCES \`InventoryMovementType\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE;
      `, 'FK InventoryMovement -> InventoryMovementType');
    }

    const [idxExists] = await conn.query(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = 'reporte_quintas' AND TABLE_NAME = 'InventoryMovement'
        AND INDEX_NAME = 'InventoryMovement_movementTypeId_fkey'
    `);
    if (idxExists.length === 0) {
      await run(`CREATE INDEX \`InventoryMovement_movementTypeId_fkey\` ON \`InventoryMovement\`(\`movementTypeId\`);`, 'Indice movementTypeId');
    }

    await run(`ALTER TABLE \`InventoryMovement\` DROP COLUMN \`type\`;`, 'Eliminar columna type (enum viejo)');
  } else {
    console.log('▶ La columna type ya no existe: migracion ya aplicada previamente.');
  }

  console.log('\n✅ Migracion completada con exito.');
} catch (err) {
  console.error('\n❌ ERROR EN MIGRACION:', err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
