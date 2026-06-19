import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { createConnection } from 'mysql2/promise';

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


