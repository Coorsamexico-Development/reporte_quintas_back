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
  console.log(`📡 Intentando escuchar en el puerto: ${port}`);
  
  await app.listen(port);
  console.log(`✅ Aplicación lista y escuchando en el puerto ${port}`);
}
bootstrap();
