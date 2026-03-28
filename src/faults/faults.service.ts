import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FaultSeverity, FaultStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

export class CreateFaultDto {
  vehicleId: number;
  description: string;
  severity: FaultSeverity;
}

@Injectable()
export class FaultsService {
  constructor(
    private readonly db: PrismaService,
    private readonly storage: StorageService
  ) {}

  async reportFault(data: CreateFaultDto, file?: Express.Multer.File) {
    try {
      const fault = await this.db.fault.create({
        data: {
          vehicleId: Number(data.vehicleId),
          description: data.description,
          severity: data.severity,
          status: FaultStatus.PENDING,
        },
      });

      if (file) {
        const url = await this.storage.uploadFile(file, 'faults');
        await this.db.faultEvidence.create({
          data: {
            faultId: fault.id,
            url,
          },
        });
      }

      return fault;
    } catch (error) {
      console.error('Error reporting fault:', error);
      throw new InternalServerErrorException('Failed to report fault');
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
