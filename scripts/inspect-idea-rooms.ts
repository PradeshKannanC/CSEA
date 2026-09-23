import { prisma } from '../lib/prisma';

async function main() {
  const ideas = await prisma.idea.findMany({
    include: {
      team: { include: { room: true } },
      room: true,
    },
  });

  console.log('Total ideas in DB:', ideas.length);
  for (const i of ideas) {
    console.log(`Idea "${i.title}" (${i.anonymousId}, id=${i.id}):`);
    console.log(`  idea.roomId: ${i.roomId} (${i.room?.name || 'NULL'})`);
    console.log(`  team.id: ${i.team.id}, team.name: ${i.team.name}, team.roomId: ${i.team.roomId} (${i.team.room?.name || 'NULL'})`);
    console.log(`  Rooms match: ${i.roomId === i.team.roomId}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
