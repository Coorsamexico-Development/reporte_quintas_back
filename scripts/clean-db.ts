import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning database...');

  // Delete in order to avoid foreign key constraints
  await prisma.maintenanceEvidence.deleteMany();
  await prisma.maintenanceTicket.deleteMany();
  await prisma.maintenancePart.deleteMany();
  await prisma.faultEvidence.deleteMany();
  await prisma.fault.deleteMany();
  await prisma.maintenance.deleteMany();
  await prisma.vehicleDocumentEvidence.deleteMany();
  await prisma.vehicleDocument.deleteMany();
  await prisma.vehicleMovement.deleteMany();
  await prisma.tireRotation.deleteMany();
  await prisma.partExchange.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.product.deleteMany();
  await prisma.cedis.deleteMany();
  await prisma.documentType.deleteMany();
  await prisma.transmission.deleteMany();
  await prisma.fuelType.deleteMany();
  await prisma.modelYear.deleteMany();

  console.log('Database cleaned. Users preserved.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
