// upload_assignments_to_prod.mjs
// Lee VehicleShiftAssignment del dump local, mapea IDs contra produccion, y sube los registros.

import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

// ─── Conexiones ──────────────────────────────────────────────────────────────
console.log('🔌 Conectando a producción (proxy 127.0.0.1:3307)...');
const prod = await createConnection({
  host: '127.0.0.1', port: 3307,
  user: 'root', password: "P],l{e)0s`l/MM<$",
  database: 'reporte_quintas', multipleStatements: true,
});
console.log('✅ Conectado a producción.');

// ─── Obtener Vehicles y Shifts de producción ─────────────────────────────────
const [prodVehicles] = await prod.query('SELECT id, plate FROM Vehicle');
const [prodShifts]   = await prod.query('SELECT id, name, cedisId FROM Shift');

console.log(`📋 Producción: ${prodVehicles.length} vehículos, ${prodShifts.length} turnos`);
console.log('Turnos en producción:', prodShifts.map(s => `id=${s.id} name=${s.name} cedisId=${s.cedisId}`));
console.log('Vehículos en producción:', prodVehicles.map(v => `id=${v.id} plate=${v.plate}`));

// ─── Leer dump local para obtener IDs originales de Vehicles y Shifts ────────
const dump = readFileSync('prod_data_seed.sql', 'utf8');

// Extraer los registros de Vehicle del dump (para mapear localId -> plate)
const vehicleMatches = [...dump.matchAll(/\((\d+),'([^']+)','([^']*)',(\d+),\d+,\d+,[^)]+\)/g)];
// Extraer Shift del dump (id, name, startTime, endTime, cedisId)
const shiftMatches = [...dump.matchAll(/INSERT INTO `Shift`[^;]+;/gs)];

// Mejor enfoque: parsear directamente la sección VehicleShiftAssignment del dump
const vsaSection = dump.match(/INSERT INTO `VehicleShiftAssignment`[^;]+;/s);
if (!vsaSection) {
  console.error('❌ No se encontró VehicleShiftAssignment en el dump.');
  process.exit(1);
}

// Extraer todos los valores: (id, date, shiftId, vehicleId, status, createdAt, updatedAt)
const vsaRows = [...vsaSection[0].matchAll(/\((\d+),'([^']+)',(\d+),(\d+),'([^']+)','([^']+)','([^']+)'\)/g)];
console.log(`\n📊 Registros encontrados en dump: ${vsaRows.length}`);

// ─── Obtener Vehicles y Shifts del dump (tabla local) ────────────────────────
// Parsear Shift del dump
const shiftSection = dump.match(/INSERT INTO `Shift` \([^)]+\) VALUES\n([^;]+);/s);
const localShifts = shiftSection 
  ? [...shiftSection[1].matchAll(/\((\d+),'([^']+)','([^']+)','([^']+)',(\d+),/g)]
      .map(m => ({ id: parseInt(m[1]), name: m[2], cedisId: parseInt(m[5]) }))
  : [];

// Parsear Vehicle del dump
const vehicleSection = dump.match(/INSERT INTO `Vehicle`[^;]+;/s);
const localVehicles = vehicleSection
  ? [...vehicleSection[0].matchAll(/\((\d+),'([^']+)',/g)]
      .map(m => ({ id: parseInt(m[1]), plate: m[2] }))
  : [];

console.log('Turnos locales:', localShifts.map(s => `id=${s.id} name=${s.name} cedisId=${s.cedisId}`));
console.log('Vehículos locales (primeros 5):', localVehicles.slice(0, 5).map(v => `id=${v.id} plate=${v.plate}`));

// ─── Mapear IDs: local -> producción ─────────────────────────────────────────
// Mapear shifts por nombre + cedisId
const localToProdShift = new Map();
for (const ls of localShifts) {
  const ps = prodShifts.find(p => p.name === ls.name && p.cedisId === ls.cedisId);
  if (ps) {
    localToProdShift.set(ls.id, ps.id);
    console.log(`  Shift map: local_id=${ls.id} "${ls.name}" -> prod_id=${ps.id}`);
  } else {
    console.warn(`  ⚠️ Shift no encontrado en prod: local_id=${ls.id} "${ls.name}" cedisId=${ls.cedisId}`);
  }
}

// Mapear vehicles por plate
const localToProdVehicle = new Map();
for (const lv of localVehicles) {
  const pv = prodVehicles.find(p => p.plate === lv.plate);
  if (pv) {
    localToProdVehicle.set(lv.id, pv.id);
  }
}
console.log(`  Vehículos mapeados: ${localToProdVehicle.size}/${localVehicles.length}`);

// ─── Insertar en producción ───────────────────────────────────────────────────
let inserted = 0, skipped = 0, noShift = 0, noVehicle = 0;

// Preparar rows para insertar (sin ID para auto-increment)
const toInsert = [];
for (const m of vsaRows) {
  const localShiftId   = parseInt(m[3]);
  const localVehicleId = parseInt(m[4]);
  const date           = m[2];
  const status         = m[5];
  const createdAt      = m[6];
  const updatedAt      = m[7];

  const prodShiftId   = localToProdShift.get(localShiftId);
  const prodVehicleId = localToProdVehicle.get(localVehicleId);

  if (!prodShiftId)   { noShift++;   continue; }
  if (!prodVehicleId) { noVehicle++; continue; }

  toInsert.push([date, prodShiftId, prodVehicleId, status, createdAt, updatedAt]);
}

console.log(`\n📦 Registros a insertar: ${toInsert.length} (sin shift: ${noShift}, sin vehículo: ${noVehicle})`);

if (toInsert.length === 0) {
  console.error('❌ No hay registros para insertar. Revisar el mapeo.');
  await prod.end();
  process.exit(1);
}

// Insertar en lotes de 500, ignorando duplicados
const batchSize = 500;
for (let i = 0; i < toInsert.length; i += batchSize) {
  const batch = toInsert.slice(i, i + batchSize);
  const values = batch.map(r => `('${r[0]}',${r[1]},${r[2]},'${r[3]}','${r[4]}','${r[5]}')`).join(',\n');
  try {
    await prod.query(
      `INSERT IGNORE INTO VehicleShiftAssignment (date, shiftId, vehicleId, status, createdAt, updatedAt) VALUES ${values}`
    );
    inserted += batch.length;
    process.stdout.write(`\r  ⬆️  ${inserted}/${toInsert.length} insertados...`);
  } catch (err) {
    console.warn(`\n  ⚠️ Error en lote: ${err.message.slice(0, 100)}`);
    skipped += batch.length;
  }
}

console.log(`\n\n✅ LISTO: ${inserted} registros subidos a producción. Duplicados ignorados: ${skipped}`);

// Verificar conteo final en producción
const [[{count}]] = await prod.query('SELECT COUNT(*) as count FROM VehicleShiftAssignment');
console.log(`📊 Total en producción ahora: ${count} registros`);

await prod.end();
