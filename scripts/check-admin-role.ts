
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@admin.com' },
  });

  if (user) {
    console.log(`User found: ${user.email} | Current Role: ${user.role}`);
    if (user.role !== 'ADMIN') {
      console.log('Promoting to ADMIN...');
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      console.log('User promoted successfully.');
    } else {
      console.log('User is already ADMIN.');
    }
  } else {
    console.log('User admin@admin.com not found.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
