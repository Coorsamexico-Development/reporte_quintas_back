import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogsService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        // Seed basic data if empty
        await this.seedCatalogs();
    }

    async findAllTransmissions() {
        return this.prisma.transmission.findMany({ orderBy: { name: 'asc' } });
    }

    async findAllFuelTypes() {
        return this.prisma.fuelType.findMany({ orderBy: { name: 'asc' } });
    }

    async findAllModelYears() {
        return this.prisma.modelYear.findMany({ orderBy: { year: 'desc' } });
    }

    // CRUD for Transmissions
    async createTransmission(data: { name: string }) {
        return this.prisma.transmission.create({ data });
    }
    async updateTransmission(id: number, data: { name: string }) {
        return this.prisma.transmission.update({ where: { id }, data });
    }
    async removeTransmission(id: number) {
        return this.prisma.transmission.delete({ where: { id } });
    }

    // CRUD for FuelTypes
    async createFuelType(data: { name: string }) {
        return this.prisma.fuelType.create({ data });
    }
    async updateFuelType(id: number, data: { name: string }) {
        return this.prisma.fuelType.update({ where: { id }, data });
    }
    async removeFuelType(id: number) {
        return this.prisma.fuelType.delete({ where: { id } });
    }

    // CRUD for ModelYears
    async createModelYear(data: { year: number }) {
        return this.prisma.modelYear.create({ data });
    }
    async updateModelYear(id: number, data: { year: number }) {
        return this.prisma.modelYear.update({ where: { id }, data });
    }
    async removeModelYear(id: number) {
        return this.prisma.modelYear.delete({ where: { id } });
    }

    // CRUD for DocumentTypes
    async findAllDocumentTypes() {
        return this.prisma.documentType.findMany({ orderBy: { name: 'asc' } });
    }
    async createDocumentType(data: { name: string; description?: string; alertDays?: number }) {
        return this.prisma.documentType.create({ data });
    }
    async updateDocumentType(id: number, data: { name?: string; description?: string; alertDays?: number }) {
        return this.prisma.documentType.update({ where: { id }, data });
    }
    async removeDocumentType(id: number) {
        return this.prisma.documentType.delete({ where: { id } });
    }

    private async seedCatalogs() {
        const transCount = await this.prisma.transmission.count();
        if (transCount === 0) {
            await this.prisma.transmission.createMany({
                data: [
                    { name: 'Manual' },
                    { name: 'Automática' },
                    { name: 'Automatizada' },
                    { name: 'CVT' },
                ],
            });
        }

        const fuelCount = await this.prisma.fuelType.count();
        if (fuelCount === 0) {
            await this.prisma.fuelType.createMany({
                data: [
                    { name: 'Gasolina' },
                    { name: 'Diésel' },
                    { name: 'Híbrido' },
                    { name: 'Eléctrico' },
                    { name: 'Gas LP' },
                ],
            });
        }

        const yearCount = await this.prisma.modelYear.count();
        if (yearCount === 0) {
            const currentYear = new Date().getFullYear();
            const years: { year: number }[] = [];
            for (let y = currentYear + 1; y >= 2010; y--) {
                years.push({ year: y });
            }
            await this.prisma.modelYear.createMany({ data: years });
        }
    }
}
