// check_prod_data.mjs — checks attendance records in production DB via Prisma
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// Set DATABASE_URL to the production proxy connection
process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3307/reporte_quintas';

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

try {
  console.log('🔌 Connected via Prisma...');
  
  const assignmentCount = await prisma.vehicleShiftAssignment.count();
  console.log(`📊 VehicleShiftAssignment count: ${assignmentCount}`);
  
  const formFieldCount = await prisma.cedisFormField.count();
  console.log(`📊 CedisFormField count: ${formFieldCount}`);
  
  const shiftCount = await prisma.shift.count();
  console.log(`📊 Shift count: ${shiftCount}`);
  
  const periodCount = await prisma.cedisCommitmentPeriod.count();
  console.log(`📊 CedisCommitmentPeriod count: ${periodCount}`);
  
  const cedisCount = await prisma.cedis.count();
  console.log(`📊 Cedis count: ${cedisCount}`);

  const cedisList = await prisma.cedis.findMany({ select: { id: true, name: true, commitmentType: true } });
  console.log('📋 Cedis list:', JSON.stringify(cedisList, null, 2));

} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await prisma.$disconnect();
}
