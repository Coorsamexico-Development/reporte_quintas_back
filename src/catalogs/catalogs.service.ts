import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
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
    const brand = await this.prisma.vehicleBrand.findUnique({ where: { id } });
    if (!brand) throw new NotFoundException('La marca no existe');

    const vehicleCount = await this.prisma.vehicle.count({
      where: { brandId: id }
    });

    if (vehicleCount > 0) {
      throw new BadRequestException(`No se puede eliminar la marca "${brand.name}" porque está asignada a ${vehicleCount} vehículos.`);
    }

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
    const transmission = await this.prisma.transmissionType.findUnique({ where: { id } });
    if (!transmission) throw new NotFoundException('El tipo de transmisión no existe');

    const vehicleCount = await this.prisma.vehicle.count({
      where: { transmissionId: id }
    });

    if (vehicleCount > 0) {
      throw new BadRequestException(`No se puede eliminar la transmisión "${transmission.name}" porque está asignada a ${vehicleCount} vehículos.`);
    }

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
    const fuelType = await this.prisma.fuelType.findUnique({ where: { id } });
    if (!fuelType) throw new NotFoundException('El tipo de combustible no existe');

    const vehicleCount = await this.prisma.vehicle.count({
      where: { fuelTypeId: id }
    });

    if (vehicleCount > 0) {
      throw new BadRequestException(`No se puede eliminar el combustible "${fuelType.name}" porque está asignado a ${vehicleCount} vehículos.`);
    }

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
    const mType = await this.prisma.maintenanceType.findUnique({ where: { id } });
    if (!mType) throw new NotFoundException('El tipo de mantenimiento no existe');

    const maintenanceCount = await this.prisma.maintenance.count({ where: { maintenanceTypeId: id } });
    const scheduledCount = await this.prisma.scheduledMaintenance.count({ where: { maintenanceTypeId: id } });
    const ticketItemCount = await this.prisma.maintenanceTicketItem.count({ where: { maintenanceTypeId: id } });

    if (maintenanceCount > 0 || scheduledCount > 0 || ticketItemCount > 0) {
      let msg = `No se puede eliminar "${mType.name}" porque tiene: `;
      const details: string[] = [];
      if (maintenanceCount > 0) details.push(`${maintenanceCount} registros de mantenimiento`);
      if (scheduledCount > 0) details.push(`${scheduledCount} mantenimientos programados`);
      if (ticketItemCount > 0) details.push(`${ticketItemCount} partidas en tickets`);
      
      throw new BadRequestException(msg + details.join(', ') + '.');
    }

    return this.prisma.maintenanceType.delete({
      where: { id }
    });
  }
}
