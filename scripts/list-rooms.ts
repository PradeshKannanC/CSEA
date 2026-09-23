import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rooms = await prisma.room.findMany({ select: { id: true, name: true, code: true, status: true } });
  console.log(`TOTAL ROOMS: ${rooms.length}`);
  console.log(JSON.stringify(rooms, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
