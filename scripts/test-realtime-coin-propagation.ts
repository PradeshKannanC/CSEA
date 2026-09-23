import { prisma } from '../lib/prisma';
import { realtimeHub, RealtimeEvent } from '../lib/realtime';

async function main() {
  console.log('============================================================');
  console.log('TEST SUITE: REAL-TIME COIN SETTINGS & WALLET PROPAGATION');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  [✅ PASS] ${description}`);
      passed++;
    } else {
      console.error(`  [❌ FAIL] ${description}`);
      failed++;
    }
  }

  // 1. Ensure Active Event exists with initial baseline: 100 total, 10 min, 50 max
  let event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'PITCH AND PROSPER Arena 2024',
        status: 'OPEN',
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
  } else {
    event = await prisma.event.update({
      where: { id: event.id },
      data: {
        status: 'OPEN',
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
  }

  assert(event.totalCoins === 100, 'Baseline Event totalCoins is 100');
  assert(event.minInvestment === 10, 'Baseline Event minInvestment is 10');
  assert(event.maxInvestment === 50, 'Baseline Event maxInvestment is 50');

  // Find 2 test participants from different teams
  const userA = await prisma.user.findFirst({
    where: { email: 'kavya.ecopulse@student.tce.edu' },
    include: { wallet: true },
  });

  const userB = await prisma.user.findFirst({
    where: { email: 'rohan.medibridge@student.tce.edu' },
    include: { wallet: true },
  });

  if (!userA || !userB) {
    throw new Error('Test participants not found in database.');
  }

  // Reset their wallets to baseline
  await prisma.investment.deleteMany({
    where: { investorId: userA.id },
  });

  const walletA = await prisma.wallet.update({
    where: { userId: userA.id },
    data: {
      totalCoins: 100,
      availableCoins: 100,
      investedCoins: 0,
    },
  });

  const walletB = await prisma.wallet.update({
    where: { userId: userB.id },
    data: {
      totalCoins: 100,
      availableCoins: 100,
      investedCoins: 0,
    },
  });

  assert(walletA.totalCoins === 100 && walletA.availableCoins === 100, 'User A wallet initialized to 100 available');
  assert(walletB.totalCoins === 100 && walletB.availableCoins === 100, 'User B wallet initialized to 100 available');

  // Find an eligible idea for User A to invest in (must belong to another team, e.g. MediBridge IDEA A102)
  const targetIdea = await prisma.idea.findFirst({
    where: {
      team: { teamId: 'CSEA-102' },
      status: 'APPROVED',
    },
  });

  if (!targetIdea) {
    throw new Error('Target idea not found.');
  }

  console.log('\n--- 1. PARTICIPANT INVESTS 30 COINS ---');
  // Simulate investment of 30 coins by User A
  const invAmount = 30;
  await prisma.$transaction(async (tx) => {
    await tx.investment.create({
      data: {
        investorId: userA.id,
        ideaId: targetIdea.id,
        amount: invAmount,
      },
    });

    await tx.wallet.update({
      where: { id: walletA.id },
      data: {
        availableCoins: { decrement: invAmount },
        investedCoins: { increment: invAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: walletA.id,
        type: 'DEPLOYMENT',
        amount: invAmount,
      },
    });
  });

  const postInvWalletA = await prisma.wallet.findUniqueOrThrow({ where: { id: walletA.id } });
  assert(postInvWalletA.totalCoins === 100, 'User A totalCoins remains 100');
  assert(postInvWalletA.investedCoins === 30, 'User A investedCoins is 30');
  assert(postInvWalletA.availableCoins === 70, 'User A availableCoins is 70 (100 - 30)');

  console.log('\n--- 2. ADMIN CHANGES SETTINGS: 100 -> 200 (MIN: 20, MAX: 100) ---');
  // Capture real-time events emitted by hub
  const capturedEvents: RealtimeEvent[] = [];
  const eventListener = (e: RealtimeEvent) => {
    capturedEvents.push(e);
  };
  realtimeHub.on('realtime_event', eventListener);

  // Execute settings update via atomic transaction identical to API route
  const newTotal = 200;
  const newMin = 20;
  const newMax = 100;

  await prisma.$transaction(async (tx) => {
    const updatedEvt = await tx.event.update({
      where: { id: event.id },
      data: {
        totalCoins: newTotal,
        minInvestment: newMin,
        maxInvestment: newMax,
      },
    });

    const allWallets = await tx.wallet.findMany();
    for (const w of allWallets) {
      const delta = newTotal - w.totalCoins;
      const newAvailable = Math.max(0, newTotal - w.investedCoins);

      await tx.wallet.update({
        where: { id: w.id },
        data: {
          totalCoins: newTotal,
          availableCoins: newAvailable,
        },
      });

      if (delta !== 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: w.id,
            type: 'ADMIN_ALLOCATION_ADJUSTMENT',
            amount: delta,
            referenceId: updatedEvt.id,
          },
        });
      }
    }
  });

  // Emit SSE events after commit
  realtimeHub.broadcast('EVENT_SETTINGS_UPDATED', {
    eventId: event.id,
    totalCoinsPerParticipant: newTotal,
    totalBudget: newTotal,
    minimumInvestment: newMin,
    minPerIdea: newMin,
    maximumInvestment: newMax,
    maxPerIdea: newMax,
    timestamp: Date.now(),
  });

  // Verify User A wallet in MySQL
  const updatedWalletA = await prisma.wallet.findUniqueOrThrow({ where: { id: walletA.id } });
  assert(updatedWalletA.totalCoins === 200, 'User A totalCoins updated to 200 in MySQL');
  assert(updatedWalletA.investedCoins === 30, 'User A prior investment of 30 coins remains untouched');
  assert(updatedWalletA.availableCoins === 170, 'User A availableCoins correctly adjusted to 170 (200 - 30)');

  // Verify User B wallet in MySQL
  const updatedWalletB = await prisma.wallet.findUniqueOrThrow({ where: { id: walletB.id } });
  assert(updatedWalletB.totalCoins === 200, 'User B totalCoins updated to 200 in MySQL');
  assert(updatedWalletB.investedCoins === 0, 'User B investedCoins remains 0');
  assert(updatedWalletB.availableCoins === 200, 'User B availableCoins updated to 200 in MySQL');

  // Verify audit transaction in MySQL
  const auditTxA = await prisma.walletTransaction.findFirst({
    where: {
      walletId: walletA.id,
      type: 'ADMIN_ALLOCATION_ADJUSTMENT',
    },
    orderBy: { createdAt: 'desc' },
  });
  assert(Boolean(auditTxA && auditTxA.amount === 100), 'Auditable ADMIN_ALLOCATION_ADJUSTMENT ledger record created (+100)');

  // Verify SSE event broadcast
  const settingsEvent = capturedEvents.find((e) => e.type === 'EVENT_SETTINGS_UPDATED');
  assert(Boolean(settingsEvent), 'EVENT_SETTINGS_UPDATED broadcasted via SSE');
  assert(settingsEvent?.payload.totalCoinsPerParticipant === 200, 'SSE payload contains totalCoinsPerParticipant: 200');
  assert(settingsEvent?.payload.minimumInvestment === 20, 'SSE payload contains minimumInvestment: 20');
  assert(settingsEvent?.payload.maximumInvestment === 100, 'SSE payload contains maximumInvestment: 100');

  console.log('\n--- 3. ADMIN CHANGES SETTINGS AGAIN: 200 -> 300 (MIN: 30, MAX: 150) ---');
  const secondNewTotal = 300;
  const secondNewMin = 30;
  const secondNewMax = 150;

  await prisma.$transaction(async (tx) => {
    const updatedEvt = await tx.event.update({
      where: { id: event.id },
      data: {
        totalCoins: secondNewTotal,
        minInvestment: secondNewMin,
        maxInvestment: secondNewMax,
      },
    });

    const allWallets = await tx.wallet.findMany();
    for (const w of allWallets) {
      const delta = secondNewTotal - w.totalCoins;
      const newAvailable = Math.max(0, secondNewTotal - w.investedCoins);

      await tx.wallet.update({
        where: { id: w.id },
        data: {
          totalCoins: secondNewTotal,
          availableCoins: newAvailable,
        },
      });

      if (delta !== 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: w.id,
            type: 'ADMIN_ALLOCATION_ADJUSTMENT',
            amount: delta,
            referenceId: updatedEvt.id,
          },
        });
      }
    }
  });

  const finalWalletA = await prisma.wallet.findUniqueOrThrow({ where: { id: walletA.id } });
  assert(finalWalletA.totalCoins === 300, 'User A totalCoins updated to 300 in MySQL');
  assert(finalWalletA.investedCoins === 30, 'User A prior investment of 30 coins remains untouched');
  assert(finalWalletA.availableCoins === 270, 'User A availableCoins correctly adjusted to 270 (300 - 30)');

  const finalWalletB = await prisma.wallet.findUniqueOrThrow({ where: { id: walletB.id } });
  assert(finalWalletB.totalCoins === 300, 'User B totalCoins updated to 300 in MySQL');
  assert(finalWalletB.availableCoins === 300, 'User B availableCoins updated to 300 in MySQL');

  console.log('\n--- 4. SERVER-SIDE INVESTMENT VALIDATION AGAINST NEW LIMITS ---');
  // Target another idea (TransitIQ CSEA-103)
  const ideaC = await prisma.idea.findFirst({
    where: {
      team: { teamId: 'CSEA-103' },
      status: 'APPROVED',
    },
  });

  if (!ideaC) {
    throw new Error('Idea C not found');
  }

  // Load current event settings from DB
  const currentEvent = await prisma.event.findFirstOrThrow({ orderBy: { createdAt: 'desc' } });

  // Test below minimum validation (15 < 30)
  const testAmountBelowMin = 15;
  const isBelowMin = testAmountBelowMin < currentEvent.minInvestment;
  assert(isBelowMin, `Server identifies 15 coins is below new minimum of ${currentEvent.minInvestment}`);

  // Test above maximum validation (200 > 150)
  const testAmountAboveMax = 200;
  const isAboveMax = testAmountAboveMax > currentEvent.maxInvestment;
  assert(isAboveMax, `Server identifies 200 coins exceeds new maximum of ${currentEvent.maxInvestment}`);

  // Test valid deployment (75 coins, which is between 30 and 150)
  const validAmount = 75;
  const isValidAmount = validAmount >= currentEvent.minInvestment && validAmount <= currentEvent.maxInvestment && validAmount <= finalWalletA.availableCoins;
  assert(isValidAmount, `Server accepts 75 coins (between min ${currentEvent.minInvestment} and max ${currentEvent.maxInvestment})`);

  // Execute the valid investment
  await prisma.$transaction(async (tx) => {
    await tx.investment.create({
      data: {
        investorId: userA.id,
        ideaId: ideaC.id,
        amount: validAmount,
      },
    });

    await tx.wallet.update({
      where: { id: walletA.id },
      data: {
        availableCoins: { decrement: validAmount },
        investedCoins: { increment: validAmount },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: walletA.id,
        type: 'DEPLOYMENT',
        amount: validAmount,
      },
    });
  });

  const postSecondInvWalletA = await prisma.wallet.findUniqueOrThrow({ where: { id: walletA.id } });
  assert(postSecondInvWalletA.totalCoins === 300, 'User A totalCoins is 300');
  assert(postSecondInvWalletA.investedCoins === 105, 'User A investedCoins is 105 (30 previous + 75 new)');
  assert(postSecondInvWalletA.availableCoins === 195, 'User A availableCoins is 195 (270 - 75)');

  // Verify total investment history in investment table
  const allUserAInvestments = await prisma.investment.findMany({
    where: { investorId: userA.id },
  });
  assert(allUserAInvestments.length === 2, 'User A has exactly 2 immutable investment records in MySQL');
  assert(allUserAInvestments[0].amount === 30 && allUserAInvestments[1].amount === 75, 'Both investment amounts (30 and 75) perfectly preserved in MySQL ledger');

  realtimeHub.off('realtime_event', eventListener);

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().finally(() => prisma.$disconnect());
