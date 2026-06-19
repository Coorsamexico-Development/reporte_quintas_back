import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';

// Capturar errores no manejados a nivel global
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

async function bootstrap() {
  try {
    console.log('🏁 Starting application bootstrap...');
    
    // Inspección y ajuste dinámico de DATABASE_URL para Cloud Run (socket Unix)
    if (process.env.DATABASE_URL) {
      console.log('Inspect DATABASE_URL:', process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':****@')); // Ocultar contraseña en logs
      
      const dbUrl = process.env.DATABASE_URL;
      const socketMatch = dbUrl.match(/\?socket=([^&]+)/);
      if (socketMatch) {
        const originalSocketPath = socketMatch[1];
        console.log(`Detected socket path in DATABASE_URL: ${originalSocketPath}`);
        
        if (originalSocketPath.endsWith('/mysql.sock')) {
          const alternativePath = originalSocketPath.replace('/mysql.sock', '');
          
          console.log(`Checking if socket files exist...`);
          console.log(`- Original path (${originalSocketPath}): exists? ${existsSync(originalSocketPath)}`);
          console.log(`- Alternative path (${alternativePath}): exists? ${existsSync(alternativePath)}`);
          
          // Si el archivo mysql.sock no existe, pero el path base sí existe,
          // significa que Cloud Run Gen2 montó el socket directamente en el path base.
          if (!existsSync(originalSocketPath) && existsSync(alternativePath)) {
            console.log(`⚠️ Correcting socket path to Gen2 format: ${alternativePath}`);
            process.env.DATABASE_URL = dbUrl.replace(originalSocketPath, alternativePath);
            console.log('New DATABASE_URL set:', process.env.DATABASE_URL.replace(/:[^:@/]+@/, ':****@'));
          }
        }
      }
    } else {
      console.log('⚠️ DATABASE_URL is not defined in process.env');
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

