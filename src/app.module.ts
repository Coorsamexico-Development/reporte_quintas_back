import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CedisModule } from './cedis/cedis.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProvidersModule } from './providers/providers.module';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CatalogsModule } from './catalogs/catalogs.module';
import { FaultsModule } from './faults/faults.module';
import { StorageModule } from './storage/storage.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    CedisModule, 
    VehiclesModule, 
    MaintenanceModule, 
    InventoryModule, 
    ProvidersModule, 
    ProductsModule, 
    UsersModule, 
    AnalyticsModule, 
    CatalogsModule, 
    FaultsModule, 
    StorageModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: any) => {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
          console.log(`[HTTP] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
        });
        next();
      })
      .forRoutes('*');
  }
}

