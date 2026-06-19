import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

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
