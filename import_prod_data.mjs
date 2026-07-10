// import_prod_data.mjs — imports prod_data_seed.sql into the DB via mysql2
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const connection = await createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'password',
  database: 'reporte_quintas',
  multipleStatements: true,
});

console.log('✅ Connected to production DB via proxy on port 3307.');

const sql = readFileSync(join(__dirname, 'prod_data_seed.sql'), 'utf8');

// Split by statement terminator to avoid issues with large multi-statement files
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

console.log(`📦 Executing ${statements.length} SQL statements...`);

let count = 0;
for (const stmt of statements) {
  try {
    await connection.query(stmt);
    count++;
  } catch (err) {
    // Ignore duplicate key errors (data may already be partially present)
    if (err.code === 'ER_DUP_ENTRY') {
      // skip silently
    } else {
      console.warn(`⚠️ Skipping statement (${err.code}): ${stmt.slice(0, 80)}...`);
    }
  }
}

await connection.end();
console.log(`✅ Done! ${count} statements executed successfully.`);
