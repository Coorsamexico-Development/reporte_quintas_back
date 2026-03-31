import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogsService {
  constructor(private prisma: PrismaService) {}

  // Brands
  async findAllBrands() {
    return this.prisma.vehicleBrand.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createBrand(name: string) {
    return this.prisma.vehicleBrand.create({
      data: { name }
    });
  }

  async deleteBrand(id: number) {
    return this.prisma.vehicleBrand.delete({
      where: { id }
    });
  }

  // Transmissions
  async findAllTransmissions() {
    return this.prisma.transmissionType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createTransmission(name: string) {
    return this.prisma.transmissionType.create({
      data: { name }
    });
  }

  async deleteTransmission(id: number) {
    return this.prisma.transmissionType.delete({
      where: { id }
    });
  }

  // Fuel Types
  async findAllFuelTypes() {
    return this.prisma.fuelType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createFuelType(name: string) {
    return this.prisma.fuelType.create({
      data: { name }
    });
  }

  async deleteFuelType(id: number) {
    return this.prisma.fuelType.delete({
      where: { id }
    });
  }

  // Maintenance Types
  async findAllMaintenanceTypes() {
    return this.prisma.maintenanceType.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createMaintenanceType(name: string) {
    return this.prisma.maintenanceType.create({
      data: { name }
    });
  }

  async deleteMaintenanceType(id: number) {
    return this.prisma.maintenanceType.delete({
      where: { id }
    });
  }
}
