import { prisma } from '../lib/prisma';

async function main() {
  const users = await prisma.user.findMany({
    include: {
      team: { include: { room: true } },
      room: true,
      wallet: true,
    },
  });

  console.log('Total users:', users.length);
  for (const u of users) {
    console.log(`User: ${u.email} (${u.id}), role=${u.role}, user.teamId=${u.teamId}, user.roomId=${u.roomId}`);
    console.log(`  Team: ${u.team ? `${u.team.name} (${u.team.id}), team.roomId=${u.team.roomId}, roomStatus=${u.team.room?.status}` : 'NONE'}`);
    console.log(`  UserRoom: ${u.room ? `${u.room.name} (${u.room.id}), status=${u.room.status}` : 'NONE'}`);
    console.log(`  Wallet: total=${u.wallet?.totalCoins}, invested=${u.wallet?.investedCoins}, avail=${u.wallet?.availableCoins}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
