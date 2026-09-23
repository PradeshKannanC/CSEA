import { prisma } from '../lib/prisma';

async function diagnosePradesh() {
  const user = await prisma.user.findFirst({
    where: { email: 'pradesh@student.tce.edu' },
    include: {
      team: { include: { room: true } },
      wallet: true,
      budgets: { include: { room: true } }
    }
  });

  if (!user) {
    console.log('User pradesh@student.tce.edu not found');
    return;
  }

  const currentRoomId = user.team?.roomId || user.roomId;

  console.log('====================================================');
  console.log('DIAGNOSTIC REPORT FOR AFFECTED PARTICIPANT');
  console.log('====================================================');
  console.log('USER ID:          ', user.id);
  console.log('EMAIL:            ', user.email);
  console.log('CURRENT TEAM ID:  ', user.teamId, user.team?.name);
  console.log('CURRENT ROOM ID:  ', currentRoomId, user.team?.room?.name, `(Status: ${user.team?.room?.status})`);

  const currentBudget = currentRoomId
    ? await prisma.participantBudget.findUnique({
        where: { userId_roomId: { userId: user.id, roomId: currentRoomId } }
      })
    : null;

  console.log('\n--- ParticipantBudget (Current Room) ---');
  if (currentBudget) {
    console.log('BUDGET ID:        ', currentBudget.id);
    console.log('allocatedCoins:   ', currentBudget.allocatedCoins);
    console.log('investedCoins:    ', currentBudget.investedCoins);
    console.log('availableCoins:   ', currentBudget.availableCoins);
  } else {
    console.log('NO ParticipantBudget found for current room!');
  }

  console.log('\n--- Legacy Wallet ---');
  console.log('WALLET ID:        ', user.wallet?.id);
  console.log('totalCoins:       ', user.wallet?.totalCoins);
  console.log('investedCoins:    ', user.wallet?.investedCoins);
  console.log('availableCoins:   ', user.wallet?.availableCoins);

  // Investments in CURRENT ROOM
  const currentRoomInvestments = currentRoomId
    ? await prisma.investment.findMany({
        where: { investorId: user.id, roomId: currentRoomId },
        include: { idea: true }
      })
    : [];

  const currentRoomSum = currentRoomInvestments.reduce((s, i) => s + i.amount, 0);

  console.log('\n--- Investments in CURRENT ROOM ---');
  console.log('Count:            ', currentRoomInvestments.length);
  console.log('SUM(amount):      ', currentRoomSum);
  for (const inv of currentRoomInvestments) {
    console.log(`  - ${inv.amount} coins -> ${inv.idea?.anonymousId} (ID: ${inv.id}) at ${inv.createdAt}`);
  }

  // Investments in OTHER ROOMS (or roomId = null)
  const otherInvestments = await prisma.investment.findMany({
    where: {
      investorId: user.id,
      OR: [
        { roomId: { not: currentRoomId } },
        { roomId: null }
      ]
    },
    include: { idea: true, room: true }
  });

  const otherSum = otherInvestments.reduce((s, i) => s + i.amount, 0);

  console.log('\n--- Investments in OTHER ROOMS / NULL ROOM ---');
  console.log('Count:            ', otherInvestments.length);
  console.log('SUM(amount):      ', otherSum);
  for (const inv of otherInvestments) {
    console.log(`  - ${inv.amount} coins -> ${inv.idea?.anonymousId} | Room: ${inv.room?.name || 'NULL'} (${inv.roomId}) at ${inv.createdAt}`);
  }

  // Invariant calculation
  console.log('\n--- INVARIANT CHECKS ---');
  if (currentBudget) {
    const calculatedAvailable = currentBudget.allocatedCoins - currentRoomSum;
    console.log(`allocatedCoins (${currentBudget.allocatedCoins}) - SUM(currentRoomInvestments) (${currentRoomSum}) = ${calculatedAvailable}`);
    console.log(`ParticipantBudget.investedCoins (${currentBudget.investedCoins}) === SUM(currentRoomInvestments) (${currentRoomSum}) ? ${currentBudget.investedCoins === currentRoomSum}`);
    console.log(`ParticipantBudget.availableCoins (${currentBudget.availableCoins}) === allocated - invested (${calculatedAvailable}) ? ${currentBudget.availableCoins === calculatedAvailable}`);
  }

  console.log('====================================================\n');
}

diagnosePradesh().finally(() => prisma.$disconnect());
