import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceTypeService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.maintenanceType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async create(data: { name: string; description?: string }) {
    return this.prisma.maintenanceType.create({
      data,
    });
  }

  async delete(id: number) {
    return this.prisma.maintenanceType.delete({
      where: { id },
    });
  }
}
