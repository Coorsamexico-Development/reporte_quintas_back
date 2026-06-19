import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const vehicle = await prisma.vehicle.findFirst({
    where: { truckNumber: 'u2' },
    include: {
      maintenanceLogs: {
        include: { tickets: { include: { items: true } } }
      }
    }
  });

  if (!vehicle) {
    console.log('Vehicle u2 not found');
    return;
  }

  console.log('Vehicle u2:', vehicle.id, vehicle.truckNumber);
  console.log('Maintenance Logs:', vehicle.maintenanceLogs.length);
  vehicle.maintenanceLogs.forEach(log => {
      console.log(`- Log ID: ${log.id}, Type: ${log.type}, Date: ${log.date}`);
      log.tickets.forEach(ticket => {
          console.log(`  - Ticket ${ticket.ticketNumber} has ${ticket.items.length} items`);
          ticket.items.forEach(item => {
              console.log(`    - RAW ITEM:`, JSON.stringify(item));
              console.log(`    - Item: ${item.description}, Cost: ${item.cost}, Labor: ${item.laborCost}`);
          });
      });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
