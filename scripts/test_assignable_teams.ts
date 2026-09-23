import { prisma } from '../lib/prisma';

async function main() {
  const pitchRoom = await prisma.room.findFirst({
    where: { name: 'Pitch' },
  });
  console.log('Pitch Room:', pitchRoom);

  if (!pitchRoom) {
    console.log('No pitch room found');
    return;
  }

  const res = await fetch(`http://localhost:3000/api/admin/rooms/${pitchRoom.id}/assignable-teams`, {
    headers: {
      // simulate without cookie first or with cookie
    }
  });
  console.log('Status without auth:', res.status);
}

main().finally(() => prisma.$disconnect());
