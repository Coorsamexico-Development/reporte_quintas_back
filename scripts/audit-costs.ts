import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const maintenances = await prisma.maintenance.findMany({
    include: {
      vehicle: true,
      parts: { include: { product: true } },
      tickets: true
    }
  });

  console.log('--- Maintenance Cost Breakdown ---');
  maintenances.forEach(m => {
    console.log(`\nMaintenance ID: ${m.id} | Vehicle: ${m.vehicle.truckNumber} | Date: ${m.date.toISOString()}`);
    let partsTotal = 0;
    m.parts.forEach(p => {
      const cost = (p.unitCost || 0) * p.quantity;
      partsTotal += cost;
      console.log(`  - Part: ${p.product.name} | Qty: ${p.quantity} | UnitCost: ${p.unitCost} | Total: ${cost}`);
    });
    let ticketsTotal = 0;
    m.tickets.forEach(t => {
      ticketsTotal += t.cost;
      console.log(`  - Ticket: ${t.ticketNumber} | Cost: ${t.cost}`);
    });
    console.log(`  TOTAL PARTS: ${partsTotal}`);
    console.log(`  TOTAL TICKETS: ${ticketsTotal}`);
    console.log(`  SUM (Current Logic): ${partsTotal + ticketsTotal}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
