import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('🚀 Iniciando aplicación...');
  const app = await NestFactory.create(AppModule);
  
  // CORS configurado para producción vía variable de entorno
  console.log('🔧 Configurando CORS...');
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  console.log(`📡 Intentando escuchar en el puerto: ${port} en 0.0.0.0`);
  
  await app.listen(port, '0.0.0.0');
  console.log(`✅ Aplicación lista y escuchando en http://0.0.0.0:${port}`);
}
bootstrap();
