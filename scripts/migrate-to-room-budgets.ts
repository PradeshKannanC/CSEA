import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING ROOM-SCOPED BUDGET MIGRATION ===');

  const event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  const defaultTotalCoins = event?.totalCoins ?? 100;
  const defaultMin = event?.minInvestment ?? 10;
  const defaultMax = event?.maxInvestment ?? 50;

  // 1. Backfill Room snapshots if null
  const rooms = await prisma.room.findMany({
    include: {
      teams: {
        include: {
          users: true,
          roster: true,
          leader: true,
        },
      },
    },
  });

  console.log(`Found ${rooms.length} rooms to process.`);

  for (const room of rooms) {
    const initialCoins = room.initialCoins ?? defaultTotalCoins;
    const minInvestment = room.minInvestment ?? defaultMin;
    const maxInvestment = room.maxInvestment ?? defaultMax;

    await prisma.room.update({
      where: { id: room.id },
      data: {
        initialCoins,
        minInvestment,
        maxInvestment,
      },
    });

    console.log(`Snapshot room "${room.name}" (${room.code}): initialCoins=${initialCoins}, min=${minInvestment}, max=${maxInvestment}`);

    // Collect all participant user IDs in this room
    const userIds = new Set<string>();
    for (const team of room.teams) {
      if (team.leaderId) userIds.add(team.leaderId);
      for (const m of team.roster) {
        if (m.userId) userIds.add(m.userId);
      }
      for (const u of team.users) {
        if (u.isActive) userIds.add(u.id);
      }
    }

    console.log(`Room "${room.name}" has ${userIds.size} unique participants.`);

    for (const userId of userIds) {
      // Calculate investments made by this user in this room
      const roomInvestments = await prisma.investment.findMany({
        where: {
          investorId: userId,
          OR: [
            { roomId: room.id },
            { idea: { team: { roomId: room.id } } },
          ],
        },
      });

      const investedCoins = roomInvestments.reduce((sum, inv) => sum + inv.amount, 0);
      const allocatedCoins = initialCoins;
      const availableCoins = Math.max(0, allocatedCoins - investedCoins);

      await prisma.participantBudget.upsert({
        where: {
          userId_roomId: {
            userId,
            roomId: room.id,
          },
        },
        create: {
          userId,
          roomId: room.id,
          eventId: room.eventId || event?.id || null,
          allocatedCoins,
          investedCoins,
          availableCoins,
        },
        update: {
          allocatedCoins,
          investedCoins,
          availableCoins,
        },
      });

      console.log(`  -> Participant ${userId} in Room ${room.code}: allocated=${allocatedCoins}, invested=${investedCoins}, available=${availableCoins}`);
    }
  }

  // 2. Also check any investments that have a roomId but participant wasn't in team users list
  const allInvestments = await prisma.investment.findMany({
    where: { roomId: { not: null } },
  });

  for (const inv of allInvestments) {
    if (!inv.roomId) continue;
    const existingBudget = await prisma.participantBudget.findUnique({
      where: {
        userId_roomId: {
          userId: inv.investorId,
          roomId: inv.roomId,
        },
      },
    });

    if (!existingBudget) {
      const room = rooms.find((r) => r.id === inv.roomId);
      const initialCoins = room?.initialCoins ?? defaultTotalCoins;
      const roomInvs = await prisma.investment.findMany({
        where: { investorId: inv.investorId, roomId: inv.roomId },
      });
      const investedCoins = roomInvs.reduce((sum, i) => sum + i.amount, 0);
      const availableCoins = Math.max(0, initialCoins - investedCoins);

      await prisma.participantBudget.create({
        data: {
          userId: inv.investorId,
          roomId: inv.roomId,
          eventId: inv.eventId,
          allocatedCoins: initialCoins,
          investedCoins,
          availableCoins,
        },
      });
      console.log(`Created missing budget for investor ${inv.investorId} in room ${inv.roomId}`);
    }
  }

  const totalBudgets = await prisma.participantBudget.count();
  console.log(`=== MIGRATION COMPLETE: ${totalBudgets} ParticipantBudget records created/updated ===`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
