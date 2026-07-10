// upload_assignments_to_prod_v2.mjs
// Lee VehicleShiftAssignment del dump completo, mapea IDs y sube a producción.

import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DUMP_PATH = join(__dirname, '..', 'reporte_quintas_dump.sql');

// ─── Conexión a producción ────────────────────────────────────────────────────
console.log('🔌 Conectando a producción...');
const prod = await createConnection({
  host: '127.0.0.1', port: 3307,
  user: 'root', password: "P],l{e)0s`l/MM<$",
  database: 'reporte_quintas', multipleStatements: true,
});
console.log('✅ Conectado a producción.');

// ─── Leer IDs de producción ──────────────────────────────────────────────────
const [prodVehicles] = await prod.query('SELECT id, plate FROM Vehicle');
const [prodShifts]   = await prod.query('SELECT id, name, cedisId FROM Shift');
console.log(`📋 Producción: ${prodVehicles.length} vehículos, ${prodShifts.length} turnos`);
console.log('Turnos prod:', prodShifts.map(s => `id=${s.id} "${s.name}" cedisId=${s.cedisId}`).join(' | '));

// ─── Parsear el dump completo ────────────────────────────────────────────────
console.log(`\n📂 Leyendo dump: ${DUMP_PATH}`);
const dump = readFileSync(DUMP_PATH, 'utf8');

// Extraer bloque de Shift del dump
const shiftInsert = dump.match(/INSERT INTO `Shift` VALUES\s*([^;]+);/s);
const localShifts = shiftInsert
  ? [...shiftInsert[1].matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',(\d+),[^)]+\)/g)]
      .map(m => ({ id: parseInt(m[1]), name: m[2], cedisId: parseInt(m[5]) }))
  : [];
console.log('Turnos locales del dump:', localShifts.map(s => `id=${s.id} "${s.name}" cedisId=${s.cedisId}`).join(' | '));

// Extraer bloque de Vehicle del dump (id y plate)
const vehicleInsert = dump.match(/INSERT INTO `Vehicle` VALUES\s*([^;]+);/s);
const localVehicles = vehicleInsert
  ? [...vehicleInsert[1].matchAll(/\((\d+),'([^']+)',/g)]
      .map(m => ({ id: parseInt(m[1]), plate: m[2] }))
  : [];
console.log(`Vehículos locales: ${localVehicles.length}`);

// Extraer VehicleShiftAssignment: (id, date, shiftId, vehicleId, status, createdAt, updatedAt)
const vsaInsert = dump.match(/INSERT INTO `VehicleShiftAssignment` VALUES\s*([^;]+);/s);
if (!vsaInsert) {
  console.error('❌ No se encontró INSERT para VehicleShiftAssignment en el dump.');
  await prod.end();
  process.exit(1);
}
const vsaRows = [...vsaInsert[1].matchAll(/\((\d+),'([^']+)',(\d+),(\d+),'([^']+)','([^']+)','([^']+)'\)/g)];
console.log(`\n📊 Registros VSA en dump: ${vsaRows.length}`);

// ─── Mapear IDs local → producción ──────────────────────────────────────────
// Shifts: por nombre (case-insensitive) y cedisId
const localToProdShift = new Map();
for (const ls of localShifts) {
  const ps = prodShifts.find(p =>
    p.name.toLowerCase() === ls.name.toLowerCase() && p.cedisId === ls.cedisId
  );
  if (ps) {
    localToProdShift.set(ls.id, ps.id);
    console.log(`  Shift: local ${ls.id} "${ls.name}" → prod ${ps.id}`);
  } else {
    // Intentar match solo por nombre
    const ps2 = prodShifts.find(p => p.name.toLowerCase() === ls.name.toLowerCase());
    if (ps2) {
      localToProdShift.set(ls.id, ps2.id);
      console.log(`  Shift (fallback): local ${ls.id} "${ls.name}" → prod ${ps2.id}`);
    } else {
      console.warn(`  ⚠️ Sin mapa: local shift ${ls.id} "${ls.name}" cedisId=${ls.cedisId}`);
    }
  }
}

// Vehicles: por plate
const localToProdVehicle = new Map();
for (const lv of localVehicles) {
  const pv = prodVehicles.find(p => p.plate === lv.plate);
  if (pv) localToProdVehicle.set(lv.id, pv.id);
}
console.log(`  Vehículos mapeados: ${localToProdVehicle.size}/${localVehicles.length}`);

// ─── Preparar registros para insertar ────────────────────────────────────────
let noShift = 0, noVehicle = 0;
const toInsert = [];

for (const m of vsaRows) {
  const localShiftId   = parseInt(m[3]);
  const localVehicleId = parseInt(m[4]);
  const date     = m[2];
  const status   = m[5];
  const created  = m[6];
  const updated  = m[7];

  const prodShiftId   = localToProdShift.get(localShiftId);
  const prodVehicleId = localToProdVehicle.get(localVehicleId);

  if (!prodShiftId)   { noShift++;   continue; }
  if (!prodVehicleId) { noVehicle++; continue; }

  toInsert.push(`('${date}',${prodShiftId},${prodVehicleId},'${status}','${created}','${updated}')`);
}

console.log(`\n📦 A insertar: ${toInsert.length} | Sin turno: ${noShift} | Sin vehículo: ${noVehicle}`);

if (toInsert.length === 0) {
  console.error('❌ 0 registros para insertar. Revisa el mapeo arriba.');
  await prod.end();
  process.exit(1);
}

// ─── Insertar en lotes ────────────────────────────────────────────────────────
const batchSize = 500;
let inserted = 0, errors = 0;

for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  try {
    await prod.query(
      `INSERT IGNORE INTO VehicleShiftAssignment (date, shiftId, vehicleId, status, createdAt, updatedAt) VALUES ${batch.join(',\n')}`
    );
    inserted += batch.length;
    process.stdout.write(`\r  ⬆️  ${inserted}/${toInsert.length} insertados...`);
  } catch (err) {
    console.warn(`\n  ⚠️ Error lote: ${err.message.slice(0, 120)}`);
    errors += batch.length;
  }
}

const [[{ total }]] = await prod.query('SELECT COUNT(*) as total FROM VehicleShiftAssignment');
console.log(`\n\n✅ LISTO. Insertados: ${inserted}, Errores: ${errors}`);
console.log(`📊 Total en producción ahora: ${total} registros`);

await prod.end();
