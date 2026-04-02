import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaultSeverity, FaultStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

export class CreateFaultDto {
  vehicleId: number;
  title: string;
  description: string;
  severity: FaultSeverity;
  scheduledId?: string | number;
}

@Injectable()
export class FaultsService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService
  ) {}

  async reportFault(data: CreateFaultDto, files?: Express.Multer.File[]) {
    try {
      const vId = Number(data.vehicleId);
      const vehicle = await this.db.vehicle.findUnique({ where: { id: vId } });
      if (!vehicle) {
        throw new Error(`El vehículo con ID ${vId} no existe`);
      }

      const fault = await this.db.fault.create({
        data: {
          vehicleId: vId,
          title: data.title,
          description: data.description,
          severity: data.severity,
          status: FaultStatus.PENDING,
        },
      });

      if (files && files.length > 0) {
        const truckNumber = vehicle.truckNumber || 'unknown';

        for (const file of files) {
          const url = await this.storage.uploadFile(file, `unidades/${truckNumber}/fallas`);
          await this.db.faultEvidence.create({
            data: {
              faultId: fault.id,
              url,
            },
          });
        }
      }

      if (data.scheduledId) {
        await this.db.scheduledMaintenance.update({
          where: { id: Number(data.scheduledId) },
          data: { status: 'COMPLETED' },
        });
      }

      return fault;
    } catch (error: any) {
      console.error('Error reporting fault:', error);
      throw new InternalServerErrorException(
        error.message ? `Error al reportar falla: ${error.message}` : 'Error interno al reportar la falla'
      );
    }
  }

  async getVehicleFaults(vehicleId: number) {
    try {
      return await this.db.fault.findMany({
        where: { vehicleId, status: FaultStatus.PENDING },
        orderBy: { reportedAt: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching vehicle faults:', error);
      throw new InternalServerErrorException('Failed to fetch vehicle faults');
    }
  }

  async getAlerts() {
    try {
      const now = new Date();
      
      const pendingFaults = await this.db.fault.findMany({
        where: { status: FaultStatus.PENDING },
        include: { vehicle: { select: { plate: true, truckNumber: true } } },
        orderBy: { reportedAt: 'asc' },
      });

      return pendingFaults.map(fault => {
        const msSinceReported = now.getTime() - new Date(fault.reportedAt).getTime();
        const daysPending = Math.floor(msSinceReported / (1000 * 60 * 60 * 24));
        
        let alertLevel = 'low';
        if (daysPending > 15) {
          alertLevel = 'red';
        } else if (daysPending > 7) {
          alertLevel = 'yellow';
        }

        return {
          ...fault,
          daysPending,
          alertLevel,
        };
      });
    } catch (error) {
      console.error('Error fetching default alerts:', error);
      throw new InternalServerErrorException(`Failed to fetch alerts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
