import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    include: {
      rooms: true,
      budgets: true,
    }
  });

  console.log(`=== EVENTS (${events.length}) ===`);
  for (const e of events) {
    console.log(`Event ID: ${e.id} | Name: "${e.name}" | Status: ${e.status} | Round: ${e.round} | Rooms: ${e.rooms.length} | Budgets: ${e.budgets.length} | Created: ${e.createdAt.toISOString()}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
