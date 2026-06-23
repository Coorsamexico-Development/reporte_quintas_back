process.env.TZ = 'America/Mexico_City';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync } from 'fs';
import { createConnection } from 'mysql2/promise';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

// Capturar errores no manejados a nivel global
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

async function testDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    console.log('⚠️ DATABASE_URL is not set in environment.');
    return;
  }

  console.log('🏁 Testing database connection options...');
  const urlStr = process.env.DATABASE_URL;
  try {
    // Usar la API URL de Node reemplazando mysql:// por http:// para poder parsearla
    const parsedUrl = new URL(urlStr.replace('mysql://', 'http://'));
    const user = parsedUrl.username;
    const password = decodeURIComponent(parsedUrl.password);
    const database = parsedUrl.pathname.replace('/', '');
    const socketPath = parsedUrl.searchParams.get('socket');

    console.log(`🔍 Parsed database configuration - User: ${user}, Database: ${database}`);

    if (socketPath) {
      // Probar el path original y el alternativo (con/sin /mysql.sock)
      const candidate1 = socketPath;
      const candidate2 = socketPath.endsWith('/mysql.sock') 
        ? socketPath.replace('/mysql.sock', '') 
        : `${socketPath}/mysql.sock`;

      const candidates = [candidate1, candidate2];

      for (const candidate of candidates) {
        console.log(`🔌 Testing Unix socket path: "${candidate}" ...`);
        try {
          const connection = await createConnection({
            user,
            password,
            database,
            socketPath: candidate,
            connectTimeout: 5000 // 5 segundos
          });
          console.log(`✅ DATABASE CONNECTION SUCCESSFUL via socket: "${candidate}"`);
          await connection.end();

          // Reconstruir y actualizar la DATABASE_URL con el socket que sí funcionó
          const newUrl = `mysql://${user}:${encodeURIComponent(password)}@localhost/${database}?socket=${candidate}`;
          process.env.DATABASE_URL = newUrl;
          console.log('➡️ process.env.DATABASE_URL updated successfully.');
          return;
        } catch (err: any) {
          console.log(`❌ Connection failed for "${candidate}": ${err.message} (Code: ${err.code || 'UNKNOWN'})`);
        }
      }
    } else {
      // Conexión TCP estándar
      const host = parsedUrl.hostname || 'localhost';
      const port = parsedUrl.port || '3306';
      console.log(`🔌 Testing TCP connection to ${host}:${port}...`);
      try {
        const connection = await createConnection({
          user,
          password,
          database,
          host,
          port: parseInt(port),
          connectTimeout: 5000
        });
        console.log(`✅ DATABASE CONNECTION SUCCESSFUL via TCP to ${host}:${port}`);
        await connection.end();
      } catch (err: any) {
        console.log(`❌ TCP connection failed: ${err.message} (Code: ${err.code || 'UNKNOWN'})`);
      }
    }
  } catch (err: any) {
    console.error('❌ Error parsing DATABASE_URL:', err.message);
  }
}

async function bootstrap() {
  try {
    console.log('🏁 Starting application bootstrap...');
    
    // Probar y corregir la conexión a la base de datos
    await testDatabaseConnection();

    // Sincronizar el esquema de la base de datos con Prisma antes de iniciar NestJS
    let skipDbPush = process.env.SKIP_DB_PUSH === 'true';
    if (!skipDbPush && existsSync('.env')) {
      try {
        const envContent = readFileSync('.env', 'utf8');
        if (envContent.includes('SKIP_DB_PUSH=true') || envContent.includes('SKIP_DB_PUSH="true"')) {
          skipDbPush = true;
        }
      } catch (err) {
        // ignore errors reading env file
      }
    }

    if (skipDbPush) {
      console.log('⏭️ Skipping database push and seeding (SKIP_DB_PUSH is true).');
    } else {
      console.log('🔄 Sincronizando esquema de base de datos con Prisma (db push)...');
      try {
        execSync('npx prisma db push --accept-data-loss', {
          env: process.env,
          stdio: 'inherit'
        });
        console.log('✅ Prisma db push completado con éxito.');
        
        // Sembrar datos por defecto programáticamente
        console.log('🌱 Sembrando datos catálogo por defecto en la base de datos... ');
        const prisma = new PrismaClient();
        try {
          // 1. Tipos de campo para formularios
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
          console.log(`  - ${fieldTypes.length} tipos de campo verificados.`);

          // 2. Roles por defecto
          const roles = [
            { name: 'ADMIN', description: 'Administrador con acceso completo.' },
            { name: 'OPERATOR', description: 'Operador con acceso básico.' },
            { name: 'CLIENTE', description: 'Cliente con acceso de consulta.' }
          ];
          for (const r of roles) {
            await prisma.role.upsert({
              where: { name: r.name },
              update: { description: r.description },
              create: {
                name: r.name,
                description: r.description,
                permissions: {
                  dashboard: { read: r.name !== 'CLIENTE' },
                  vehicles: { create: r.name === 'ADMIN', read: true, update: r.name !== 'CLIENTE', delete: r.name === 'ADMIN' },
                  users: { create: r.name === 'ADMIN', read: r.name === 'ADMIN', update: r.name === 'ADMIN', delete: r.name === 'ADMIN' },
                  catalogs: { create: r.name === 'ADMIN', read: r.name !== 'CLIENTE', update: r.name === 'ADMIN', delete: r.name === 'ADMIN' },
                  customerPanel: { read: r.name !== 'OPERATOR' }
                }
              }
            });
          }
          console.log('  - Roles ADMIN, OPERATOR y CLIENTE verificados.');

          // 3. Marcas de vehículos
          const brands = ['Kenworth','Freightliner','International','Volvo','Peterbilt','Isuzu','Hino','Mercedes-Benz','Scania','Mack'];
          for (const name of brands) {
            await prisma.vehicleBrand.upsert({ where: { name }, update: {}, create: { name } });
          }

          // 4. Tipos de transmisión
          const transmissions = ['Manual 10 Velocidades','Manual 18 Velocidades','Automática','Automatizada (Allison)','Automatizada (Eaton)'];
          for (const name of transmissions) {
            await prisma.transmissionType.upsert({ where: { name }, update: {}, create: { name } });
          }

          // 5. Tipos de combustible
          const fuels = ['Diesel','Gasolina','Gas Natural Vehicular (GNV)','Eléctrico','Híbrido'];
          for (const name of fuels) {
            await prisma.fuelType.upsert({ where: { name }, update: {}, create: { name } });
          }

          // 6. GDL Checklist, Turnos y Periodos de Compromiso
          const gdlCedis = await prisma.cedis.findFirst({ where: { name: { startsWith: 'GDL' } } });
          if (gdlCedis) {
            await prisma.cedis.update({ where: { id: gdlCedis.id }, data: { commitmentType: 'SHIFT' } });

            let matutinoShift = await prisma.shift.findFirst({ where: { name: 'Matutino', cedisId: gdlCedis.id } });
            if (!matutinoShift) {
              matutinoShift = await prisma.shift.create({ data: { name: 'Matutino', startTime: '06:00', endTime: '18:00', cedisId: gdlCedis.id } });
            }
            let nocturnoShift = await prisma.shift.findFirst({ where: { name: 'Nocturno', cedisId: gdlCedis.id } });
            if (!nocturnoShift) {
              nocturnoShift = await prisma.shift.create({ data: { name: 'Nocturno', startTime: '18:00', endTime: '06:00', cedisId: gdlCedis.id } });
            }

            await prisma.cedisCommitmentPeriod.deleteMany({ where: { cedisId: gdlCedis.id } });
            const periodsData = [
              { startDate: '2026-01-01T00:00:00Z', endDate: '2026-03-11T23:59:59Z', committedUnits: 8 },
              { startDate: '2026-03-12T00:00:00Z', endDate: '2026-05-24T23:59:59Z', committedUnits: 7 },
              { startDate: '2026-05-25T00:00:00Z', endDate: '2026-05-31T23:59:59Z', committedUnits: 9 }
            ];
            for (const p of periodsData) {
              await prisma.cedisCommitmentPeriod.create({ data: { cedisId: gdlCedis.id, shiftId: matutinoShift.id, startDate: new Date(p.startDate), endDate: new Date(p.endDate), committedUnits: p.committedUnits } });
              await prisma.cedisCommitmentPeriod.create({ data: { cedisId: gdlCedis.id, shiftId: nocturnoShift.id, startDate: new Date(p.startDate), endDate: new Date(p.endDate), committedUnits: p.committedUnits } });
            }

            // GDL Checklist Form
            const gdlForm = await prisma.cedisForm.upsert({ where: { cedisId: gdlCedis.id }, update: {}, create: { cedisId: gdlCedis.id, title: 'Checklist de Inspección Diaria (GDL)' } });
            const fieldTypesList = await prisma.fieldType.findMany();
            const typeMap = new Map(fieldTypesList.map((t: any) => [t.name, t.id]));
            const checkId = typeMap.get('CHECK')!;
            const numberId = typeMap.get('NUMBER')!;
            const selectId = typeMap.get('SELECT')!;
            const longtextId = typeMap.get('LONGTEXT')!;
            const signatureId = typeMap.get('SIGNATURE')!;

            const gdlFields = [
              { label: 'Horómetro', section: 'DATOS GENERALES', fieldTypeId: numberId, docSection: 'HEADER', columnNumber: 3, isRequired: true, options: null },
              { label: 'Nivel de gasolina', section: 'DATOS GENERALES', fieldTypeId: selectId, docSection: 'HEADER', columnNumber: 3, isRequired: true, options: JSON.stringify(['E (Vacío)', '1/4', '1/2', '3/4', 'F (Lleno)']) },
              { label: 'Presión', section: 'Sistema de compresión', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Fugas', section: 'Sistema de compresión', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Luces (general)', section: 'Sistema eléctrico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Claxon', section: 'Sistema eléctrico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Marcha', section: 'Sistema eléctrico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Switch', section: 'Sistema eléctrico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Batería', section: 'Sistema eléctrico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 1, isRequired: false, options: null },
              { label: 'Alarma de reversa', section: 'Sistema de seguridad', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Espejos', section: 'Sistema de seguridad', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Cinturón', section: 'Sistema de seguridad', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Extintor', section: 'Sistema de seguridad', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Presión', section: 'Llantas', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Desgaste', section: 'Llantas', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Tornillería', section: 'Llantas', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 2, isRequired: false, options: null },
              { label: 'Nivel de aceite', section: 'Motor', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Fugas', section: 'Motor', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Refrigerante', section: 'Motor', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Mangueras', section: 'Sistema hidráulico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Fugas', section: 'Sistema hidráulico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Pistones', section: 'Sistema hidráulico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Nivel de aceite', section: 'Sistema hidráulico', fieldTypeId: checkId, docSection: 'BODY', columnNumber: 3, isRequired: false, options: null },
              { label: 'Comentarios', section: 'COMENTARIOS', fieldTypeId: longtextId, docSection: 'FOOTER', columnNumber: 1, isRequired: false, options: null },
              { label: 'Supervisor', section: 'FIRMA', fieldTypeId: signatureId, docSection: 'FOOTER', columnNumber: 1, isRequired: true, options: null },
              { label: 'Validación', section: 'VALIDACIÓN', fieldTypeId: selectId, docSection: 'FOOTER', columnNumber: 1, isRequired: true, options: JSON.stringify(['OPERATIVA', 'NO OPERATIVA']) }
            ];

            let orderIndex = 0;
            for (const f of gdlFields) {
              const existingField = await prisma.cedisFormField.findFirst({ where: { formId: gdlForm.id, label: f.label, section: f.section } });
              if (existingField) {
                await prisma.cedisFormField.update({ where: { id: existingField.id }, data: { fieldTypeId: f.fieldTypeId, docSection: f.docSection, columnNumber: f.columnNumber, isRequired: f.isRequired, options: f.options, order: orderIndex++ } });
              } else {
                await prisma.cedisFormField.create({ data: { formId: gdlForm.id, label: f.label, section: f.section, fieldTypeId: f.fieldTypeId, docSection: f.docSection, columnNumber: f.columnNumber, isRequired: f.isRequired, options: f.options, order: orderIndex++ } });
              }
            }
            console.log('  - GDL checklist, turnos y periodos de compromiso verificados.');
          }

          console.log('✅ Sembrado de datos completado con éxito.');
        } catch (seedErr: any) {
          console.error('❌ Error durante el sembrado de base de datos:', seedErr.message);
        } finally {
          await prisma.$disconnect();
        }
      } catch (dbPushError: any) {
        console.error('❌ Error durante npx prisma db push:', dbPushError.message);
        // No hacemos crash aquí, dejamos que continúe para ver si puede levantar
      }
    }

    // Listar contenido de /cloudsql para mayor visibilidad
    try {
      if (existsSync('/cloudsql')) {
        const files = readdirSync('/cloudsql');
        console.log('🔍 Contents of /cloudsql:', files);
        for (const file of files) {
          const fullPath = join('/cloudsql', file);
          try {
            const stats = statSync(fullPath);
            console.log(`  - ${file}: isDirectory? ${stats.isDirectory()}, size: ${stats.size}`);
            if (stats.isDirectory()) {
              try {
                console.log(`    Sub-files:`, readdirSync(fullPath));
              } catch (e: any) {
                console.log(`    Failed to read directory:`, e.message);
              }
            }
          } catch (e: any) {
            console.log(`  - Error reading ${file}:`, e.message);
          }
        }
      } else {
        console.log('🔍 /cloudsql directory does not exist at root');
      }
    } catch (err: any) {
      console.error('Failed listing /cloudsql:', err.message);
    }
    
    // Asegurar que el directorio uploads exista
    const uploadsPath = join(process.cwd(), 'uploads');
    if (!existsSync(uploadsPath)) {
      mkdirSync(uploadsPath, { recursive: true });
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug', 'verbose'], // Logging detallado
    });
    
    app.enableCors();
    // Serve static files from uploads folder
    app.useStaticAssets(uploadsPath, {
      prefix: '/uploads/',
    });

    const port = process.env.PORT || 8080;
    console.log(`📡 Binding to port ${port}...`);
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Server successfully running on port ${port}`);
  } catch (error) {
    console.error('❌ FATAL ERROR DURING BOOTSTRAP:', error);
    process.exit(1);
  }
}
bootstrap();



