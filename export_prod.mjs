// export_prod.mjs
// Exporta TODA la base de datos de producción a un archivo SQL limpio.

import { createConnection } from 'mysql2/promise';
import { writeFileSync } from 'fs';

const PROD_HOST = '127.0.0.1';
const PROD_PORT = 3307;
const PROD_USER = 'root';
const PROD_PASS = "P],l{e)0s`l/MM<$";
const PROD_DB   = 'reporte_quintas';

console.log('🔌 Conectando a producción...');
const conn = await createConnection({
  host: PROD_HOST, port: PROD_PORT, user: PROD_USER,
  password: PROD_PASS, database: PROD_DB, multipleStatements: true,
});
console.log('✅ Conectado a producción.');

const [tables] = await conn.query('SHOW TABLES');
const tableNames = tables.map(r => Object.values(r)[0]);
console.log(`📋 ${tableNames.length} tablas encontradas.`);

let sql = `-- Dump de producción generado ${new Date().toISOString()}\n`;
sql += `SET FOREIGN_KEY_CHECKS=0;\nSET UNIQUE_CHECKS=0;\n\n`;

for (const table of tableNames) {
  // Obtener CREATE TABLE
  const [[createRow]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
  const createSql = createRow['Create Table'];
  sql += `-- Tabla: ${table}\nDROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n\n`;

  // Obtener datos
  const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
  if (rows.length === 0) {
    console.log(`  ⚪ ${table}: vacío`);
    continue;
  }

  const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = batch.map(row => {
      const vals = Object.values(row).map(v => {
        if (v === null) return 'NULL';
        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
        if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`;
        if (typeof v === 'object') return conn.escape(JSON.stringify(v));
        if (typeof v === 'string') return conn.escape(v);
        return v;
      });
      return `(${vals.join(', ')})`;
    }).join(',\n');
    sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n${values};\n`;
  }
  sql += '\n';
  console.log(`  ✅ ${table}: ${rows.length} filas exportadas`);
}

sql += `SET FOREIGN_KEY_CHECKS=1;\nSET UNIQUE_CHECKS=1;\n`;

writeFileSync('prod_full_dump.sql', sql, 'utf8');
console.log(`\n💾 Dump guardado en prod_full_dump.sql`);
await conn.end();
