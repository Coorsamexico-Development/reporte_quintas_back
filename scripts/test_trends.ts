import { PrismaService } from '../src/prisma/prisma.service';
import { AnalyticsService } from '../src/analytics/analytics.service';

const prisma = new PrismaService();
const analytics = new AnalyticsService(prisma);

async function main() {
    console.log('--- Iniciando prueba de getOperationalTrends ---');
    const trends = await analytics.getOperationalTrends();
    console.log(`Retrieved ${trends.length} trend records.`);
    if (trends.length > 0) {
        console.log('First trend record sample:', JSON.stringify(trends[0], null, 2));
        console.log('Last trend record sample:', JSON.stringify(trends[trends.length - 1], null, 2));
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
