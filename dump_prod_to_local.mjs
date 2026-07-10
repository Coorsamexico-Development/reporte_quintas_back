// dump_prod_to_local.mjs
// Conecta a produccion via proxy (127.0.0.1:3307) con las credenciales correctas,
// hace dump de todos los datos y los importa en la BD local de Docker (localhost:3306).

import { createConnection } from 'mysql2/promise';
import { writeFileSync } from 'fs';

// ─── 1. Conectar a PRODUCCIÓN ───────────────────────────────────────────────
console.log('🔌 Conectando a la BD de PRODUCCIÓN (proxy 127.0.0.1:3307)...');
const prod = await createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: "P],l{e)0s`l/MM<$",
  database: 'reporte_quintas',
  multipleStatements: true,
});
console.log('✅ Conectado a producción.');

// ─── 2. Conectar a LOCAL ─────────────────────────────────────────────────────
console.log('🔌 Conectando a la BD LOCAL (Docker 127.0.0.1:3307 -> local mysql en contenedor)...');
const local = await createConnection({
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'password',
  database: 'reporte_quintas',
  multipleStatements: true,
});
console.log('✅ Conectado a local.');

// ─── 3. Obtener lista de tablas de producción ────────────────────────────────
const [tables] = await prod.query(`SHOW TABLES`);
const tableNames = tables.map(r => Object.values(r)[0]);
console.log(`📋 Tablas encontradas: ${tableNames.join(', ')}`);

// ─── 4. Para cada tabla: truncar local e insertar datos de producción ────────
await local.query('SET FOREIGN_KEY_CHECKS = 0');
await local.query('SET UNIQUE_CHECKS = 0');

for (const table of tableNames) {
  try {
    // Obtener datos de producción
    const [rows] = await prod.query(`SELECT * FROM \`${table}\``);
    if (!rows || rows.length === 0) {
      console.log(`  ⚪ ${table}: vacío`);
      continue;
    }

    // Truncar tabla local
    await local.query(`TRUNCATE TABLE \`${table}\``);

    // Insertar en lotes de 500
    const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
    const batchSize = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map(row => {
        const vals = Object.values(row).map(v => {
          if (v === null) return 'NULL';
          if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
          if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "\\'")}'`;
          if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
          return v;
        });
        return `(${vals.join(', ')})`;
      }).join(',\n');
      await local.query(`INSERT INTO \`${table}\` (${cols}) VALUES ${values}`);
      inserted += batch.length;
    }
    console.log(`  ✅ ${table}: ${inserted} filas copiadas`);
  } catch (err) {
    console.warn(`  ⚠️ ${table}: ${err.message.slice(0, 120)}`);
  }
}

await local.query('SET FOREIGN_KEY_CHECKS = 1');
await local.query('SET UNIQUE_CHECKS = 1');

await prod.end();
await local.end();

console.log('\n✅ ¡Base de datos local actualizada con datos de producción!');
