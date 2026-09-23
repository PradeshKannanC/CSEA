import { prisma } from '../lib/prisma';

async function main() {
  const activeEvent = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('Active Event:', activeEvent?.id, activeEvent?.name);

  const rooms = await prisma.room.findMany();
  for (const r of rooms) {
    console.log(`Room "${r.name}" (${r.code}, ${r.id}): eventId=${r.eventId}, matchesActive=${r.eventId === activeEvent?.id}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
