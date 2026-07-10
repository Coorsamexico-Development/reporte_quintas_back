// upload_vsa_final.mjs
// Lee prod_data_seed.sql (UTF-16LE), extrae VehicleShiftAssignment, mapea IDs y sube a producción.

import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Leer dump en UTF-16LE ────────────────────────────────────────────────────
console.log('📂 Leyendo prod_data_seed.sql (UTF-16LE)...');
const raw = readFileSync(join(__dirname, 'prod_data_seed.sql'));
const dump = raw.toString('utf16le');
console.log(`📄 Tamaño: ${Math.round(raw.length/1024)} KB`);

// Verificar que tiene contenido
const sampleLine = dump.slice(0, 200).replace(/\r\n/g, ' ');
console.log('Inicio del dump:', sampleLine.slice(0, 100));

// ─── Parsear Shift del dump ───────────────────────────────────────────────────
const shiftMatches = [...dump.matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',(\d+),[^)]+\)/g)];
// Buscar la sección de Shift
const shiftSection = dump.match(/INSERT INTO `Shift`[^;]+;/s);
const localShifts = shiftSection
  ? [...shiftSection[0].matchAll(/\((\d+),'([^']+)','[^']+','[^']+',(\d+),/g)]
      .map(m => ({ id: parseInt(m[1]), name: m[2], cedisId: parseInt(m[3]) }))
  : [];
console.log('Turnos locales:', localShifts.map(s => `id=${s.id} "${s.name}" cedisId=${s.cedisId}`).join(' | '));

// ─── Parsear Vehicle del dump ─────────────────────────────────────────────────
const vehicleSection = dump.match(/INSERT INTO `Vehicle`[^;]+;/s);
const localVehicles = vehicleSection
  ? [...vehicleSection[0].matchAll(/\((\d+),'([^']+)',/g)]
      .map(m => ({ id: parseInt(m[1]), plate: m[2] }))
  : [];
console.log(`Vehículos locales: ${localVehicles.length}`);
if (localVehicles.length > 0) console.log('Muestra:', localVehicles.slice(0,3).map(v => `id=${v.id} "${v.plate}"`).join(' | '));

// ─── Parsear VehicleShiftAssignment del dump ──────────────────────────────────
const vsaSection = dump.match(/INSERT INTO `VehicleShiftAssignment`[^;]+;/s);
if (!vsaSection) {
  console.error('❌ No se encontró VehicleShiftAssignment.');
  // Mostrar qué tablas SÍ tiene el dump
  const tables = [...dump.matchAll(/INSERT INTO `(\w+)`/g)].map(m => m[1]);
  console.log('Tablas en dump:', [...new Set(tables)].join(', '));
  process.exit(1);
}

// (id, date, shiftId, vehicleId, status, createdAt, updatedAt)
const vsaRows = [...vsaSection[0].matchAll(/\((\d+),'([^']+)',(\d+),(\d+),'([^']+)','([^']+)','([^']+)'\)/g)];
console.log(`\n📊 Registros VSA encontrados: ${vsaRows.length}`);

// ─── Conectar a producción ────────────────────────────────────────────────────
console.log('\n🔌 Conectando a producción...');
const prod = await createConnection({
  host: '127.0.0.1', port: 3307,
  user: 'root', password: "P],l{e)0s`l/MM<$",
  database: 'reporte_quintas', multipleStatements: true,
});
console.log('✅ Conectado.');

const [prodVehicles] = await prod.query('SELECT id, plate FROM Vehicle');
const [prodShifts]   = await prod.query('SELECT id, name, cedisId FROM Shift');
console.log('Turnos prod:', prodShifts.map(s => `id=${s.id} "${s.name}" cedisId=${s.cedisId}`).join(' | '));
console.log(`Vehículos prod: ${prodVehicles.length}`);

// ─── Mapear IDs ───────────────────────────────────────────────────────────────
const localToProdShift = new Map();
for (const ls of localShifts) {
  const ps = prodShifts.find(p => p.name.toLowerCase() === ls.name.toLowerCase() && p.cedisId === ls.cedisId)
          || prodShifts.find(p => p.name.toLowerCase() === ls.name.toLowerCase());
  if (ps) {
    localToProdShift.set(ls.id, ps.id);
    console.log(`  Shift: local ${ls.id} "${ls.name}" → prod ${ps.id}`);
  } else {
    console.warn(`  ⚠️ Shift no encontrado: id=${ls.id} "${ls.name}" cedisId=${ls.cedisId}`);
  }
}

const localToProdVehicle = new Map();
for (const lv of localVehicles) {
  const pv = prodVehicles.find(p => p.plate === lv.plate);
  if (pv) localToProdVehicle.set(lv.id, pv.id);
}
console.log(`  Vehículos mapeados: ${localToProdVehicle.size}/${localVehicles.length}`);

// ─── Preparar registros ───────────────────────────────────────────────────────
let noShift = 0, noVehicle = 0;
const toInsert = [];

for (const m of vsaRows) {
  const localShiftId   = parseInt(m[3]);
  const localVehicleId = parseInt(m[4]);
  const prodShiftId   = localToProdShift.get(localShiftId);
  const prodVehicleId = localToProdVehicle.get(localVehicleId);
  if (!prodShiftId)   { noShift++;   continue; }
  if (!prodVehicleId) { noVehicle++; continue; }
  toInsert.push(`('${m[2]}',${prodShiftId},${prodVehicleId},'${m[5]}','${m[6]}','${m[7]}')`);
}

console.log(`\n📦 A insertar: ${toInsert.length} | Sin turno: ${noShift} | Sin vehículo: ${noVehicle}`);

if (toInsert.length === 0) {
  console.error('❌ Sin registros para insertar.');
  await prod.end(); process.exit(1);
}

// ─── Insertar en lotes ────────────────────────────────────────────────────────
const batchSize = 500;
let inserted = 0, errors = 0;
for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  try {
    await prod.query(
      `INSERT IGNORE INTO VehicleShiftAssignment (date, shiftId, vehicleId, status, createdAt, updatedAt) VALUES ${batch.join(',')}`
    );
    inserted += batch.length;
    process.stdout.write(`\r  ⬆️  ${inserted}/${toInsert.length}...`);
  } catch (err) {
    console.warn(`\n  ⚠️ ${err.message.slice(0, 100)}`);
    errors += batch.length;
  }
}

const [[{ total }]] = await prod.query('SELECT COUNT(*) as total FROM VehicleShiftAssignment');
console.log(`\n\n✅ LISTO. Insertados: ${inserted} | Errores: ${errors}`);
console.log(`📊 Total en producción ahora: ${total} VehicleShiftAssignment`);
await prod.end();
