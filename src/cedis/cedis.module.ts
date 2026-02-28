import { Module } from '@nestjs/common';
import { CedisController } from './cedis.controller';
import { CedisService } from './cedis.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CedisController],
  providers: [CedisService],
})
export class CedisModule { }
