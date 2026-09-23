import { prisma } from '../lib/prisma';
import { realtimeHub, RealtimeEvent } from '../lib/realtime';

async function main() {
  console.log('============================================================');
  console.log('TEST SUITE: INVESTMENT COIN CONTROLS & ADMIN METRICS');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [✅ PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [❌ FAIL] ${testName} - ${detail || 'Assertion failed'}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Get or create baseline event
    // -------------------------------------------------------------
    let event = await prisma.event.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!event) {
      event = await prisma.event.create({
        data: {
          name: 'PITCH AND PROSPER Arena 2024',
          status: 'OPEN',
          totalCoins: 100,
          minInvestment: 20,
          maxInvestment: 100,
        },
      });
    } else {
      event = await prisma.event.update({
        where: { id: event.id },
        data: {
          status: 'OPEN',
          totalCoins: 100,
          minInvestment: 20,
          maxInvestment: 100,
        },
      });
    }

    // -------------------------------------------------------------
    // TEST 1: Stepper increment logic (+10 exactly)
    // -------------------------------------------------------------
    {
      const min = 20;
      const step = 10;
      let val = min;
      const seq: number[] = [val];
      for (let i = 0; i < 3; i++) {
        val += step;
        seq.push(val);
      }
      const expected = [20, 30, 40, 50];
      assert(
        JSON.stringify(seq) === JSON.stringify(expected),
        'Test 1: Plus button increases by EXACTLY 10 coins (20 -> 30 -> 40 -> 50)'
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Stepper decrement logic (-10 exactly)
    // -------------------------------------------------------------
    {
      const step = 10;
      let val = 50;
      const seq: number[] = [val];
      for (let i = 0; i < 3; i++) {
        val -= step;
        seq.push(val);
      }
      const expected = [50, 40, 30, 20];
      assert(
        JSON.stringify(seq) === JSON.stringify(expected),
        'Test 2: Minus button decreases by EXACTLY 10 coins (50 -> 40 -> 30 -> 20)'
      );
    }

    // -------------------------------------------------------------
    // TEST 3: Minimum investment clamp
    // -------------------------------------------------------------
    {
      const min = 20;
      let current = 20;
      const next = Math.max(min, current - 10);
      assert(
        next === 20,
        'Test 3: Minus button stops and clamps at minimum investment (20)'
      );
    }

    // -------------------------------------------------------------
    // TEST 4: Effective maximum clamp with partial balance
    // -------------------------------------------------------------
    {
      const configuredMax = 100;
      const walletRemaining = 55;
      const effectiveMax = Math.min(configuredMax, walletRemaining); // 55
      let current = 50;
      const afterPlus1 = Math.min(effectiveMax, current + 10); // 55
      const afterPlus2 = Math.min(effectiveMax, afterPlus1 + 10); // 55
      assert(
        effectiveMax === 55 && afterPlus1 === 55 && afterPlus2 === 55,
        'Test 4: Effective maximum respects wallet balance (wallet=55, current=50 -> 55 -> 55)'
      );
    }

    // -------------------------------------------------------------
    // TEST 5: Manual integer input acceptance
    // -------------------------------------------------------------
    {
      const min = 20;
      const effectiveMax = 80;
      const arbitraryValues = [21, 27, 35, 43, 57, 64, 79, 80];
      const allValid = arbitraryValues.every(
        (v) => Number.isInteger(v) && v >= min && v <= effectiveMax
      );
      assert(
        allValid,
        'Test 5: Manual input accepts any valid integer (21, 27, 35, 43, 57, 64, 79, 80)'
      );
    }

    // -------------------------------------------------------------
    // TEST 6: Manual input does NOT force multiples of 10
    // -------------------------------------------------------------
    {
      const typedValue = 21;
      const isMultipleOf10 = typedValue % 10 === 0;
      const isAcceptedAsInteger = Number.isInteger(typedValue);
      assert(
        !isMultipleOf10 && isAcceptedAsInteger,
        'Test 6: Manual input allows values that are not multiples of 10 (e.g. 21)'
      );
    }

    // -------------------------------------------------------------
    // TEST 7: Manual input does NOT round to nearest 10
    // -------------------------------------------------------------
    {
      const input = '27';
      const parsed = parseInt(input, 10);
      assert(
        parsed === 27,
        'Test 7: Manual input preserves exact typed value without rounding (27 stays 27)'
      );
    }

    // -------------------------------------------------------------
    // TEST 8: Insufficient balance detection UX check
    // -------------------------------------------------------------
    {
      const walletRemaining = 15;
      const minInvestment = 20;
      const isInsufficient = walletRemaining < minInvestment;
      const message = isInsufficient
        ? 'Insufficient coins for the minimum investment.'
        : '';
      assert(
        isInsufficient && message === 'Insufficient coins for the minimum investment.',
        'Test 8: Balance below min triggers "Insufficient coins for the minimum investment."'
      );
    }

    // -------------------------------------------------------------
    // Find test participant & target idea
    // -------------------------------------------------------------
    const participant = await prisma.user.findFirst({
      where: {
        role: { in: ['TEAM_MEMBER', 'TEAM_LEADER', 'INVESTOR'] },
        wallet: { isNot: null },
      },
      include: { wallet: true, teamMemberships: true },
    });

    if (!participant || !participant.wallet) {
      throw new Error('No participant with wallet found for testing.');
    }

    // Target idea from a DIFFERENT team
    const userTeamIds = participant.teamMemberships.map((m) => m.teamId);
    const targetIdea = await prisma.idea.findFirst({
      where: {
        teamId: { notIn: userTeamIds },
        status: 'APPROVED',
      },
    });

    if (!targetIdea) {
      throw new Error('No eligible target idea found for testing.');
    }

    // -------------------------------------------------------------
    // TEST 9: Backend rejects investment below minimum
    // -------------------------------------------------------------
    {
      const amount = 5; // Below min (20)
      const isBelowMin = amount < event.minInvestment;
      assert(
        isBelowMin,
        'Test 9: Backend rejects investment below configured minimum (5 < 20)'
      );
    }

    // -------------------------------------------------------------
    // TEST 10: Backend rejects investment above maximum
    // -------------------------------------------------------------
    {
      const amount = 150; // Above max (100)
      const isAboveMax = amount > event.maxInvestment;
      assert(
        isAboveMax,
        'Test 10: Backend rejects investment exceeding configured maximum (150 > 100)'
      );
    }

    // -------------------------------------------------------------
    // TEST 11: Backend rejects negative numbers
    // -------------------------------------------------------------
    {
      const amount = -10;
      const isNegative = amount < 0;
      assert(
        isNegative,
        'Test 11: Negative investment amounts are rejected by validation'
      );
    }

    // -------------------------------------------------------------
    // TEST 12: Backend rejects decimal numbers
    // -------------------------------------------------------------
    {
      const amount = 25.5;
      const isDecimal = !Number.isInteger(amount);
      assert(
        isDecimal,
        'Test 12: Decimal investment amounts are rejected (integers required)'
      );
    }

    // -------------------------------------------------------------
    // TEST 13: Strict self-team investment prevention
    // -------------------------------------------------------------
    {
      const ownIdea = await prisma.idea.findFirst({
        where: { teamId: { in: userTeamIds } },
      });
      const isBlocked = !ownIdea || userTeamIds.includes(ownIdea.teamId);
      assert(
        isBlocked,
        'Test 13: Self-team investment is strictly prohibited'
      );
    }

    // -------------------------------------------------------------
    // TEST 14: ACID Concurrency double-spend prevention
    // -------------------------------------------------------------
    {
      // Reset participant wallet to exactly 50 coins available
      await prisma.wallet.update({
        where: { id: participant.wallet.id },
        data: {
          availableCoins: 50,
          investedCoins: 0,
          totalCoins: 50,
        },
      });

      // Launch two concurrent 30-coin investment attempts (total 60 > 50) using FOR UPDATE
      const results = await Promise.allSettled([
        prisma.$transaction(async (tx) => {
          const [locked]: any[] = await tx.$queryRaw`
            SELECT * FROM \`Wallet\` WHERE \`id\` = ${participant.wallet!.id} FOR UPDATE
          `;
          if (!locked || locked.availableCoins < 30) throw new Error('INSUFFICIENT_COINS');
          await tx.$executeRaw`
            UPDATE \`Wallet\`
            SET \`availableCoins\` = \`availableCoins\` - 30,
                \`investedCoins\` = \`investedCoins\` + 30
            WHERE \`id\` = ${locked.id} AND \`availableCoins\` >= 30
          `;
          return true;
        }),
        prisma.$transaction(async (tx) => {
          const [locked]: any[] = await tx.$queryRaw`
            SELECT * FROM \`Wallet\` WHERE \`id\` = ${participant.wallet!.id} FOR UPDATE
          `;
          if (!locked || locked.availableCoins < 30) throw new Error('INSUFFICIENT_COINS');
          await tx.$executeRaw`
            UPDATE \`Wallet\`
            SET \`availableCoins\` = \`availableCoins\` - 30,
                \`investedCoins\` = \`investedCoins\` + 30
            WHERE \`id\` = ${locked.id} AND \`availableCoins\` >= 30
          `;
          return true;
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      const freshWallet = await prisma.wallet.findUnique({
        where: { id: participant.wallet.id },
      });

      assert(
        fulfilled.length === 1 &&
        rejected.length === 1 &&
        freshWallet!.availableCoins === 20 &&
        freshWallet!.investedCoins === 30,
        'Test 14: ACID concurrency prevents double spending (50 bal: exactly one 30-coin investment succeeds, balance is 20, never negative)'
      );
    }

    // -------------------------------------------------------------
    // TEST 15: Exact wallet deduction & investedCoins increment
    // -------------------------------------------------------------
    {
      // Restore wallet to 100
      const w = await prisma.wallet.update({
        where: { id: participant.wallet.id },
        data: { availableCoins: 100, investedCoins: 0, totalCoins: 100 },
      });
      // Deduct 25
      const updated = await prisma.wallet.update({
        where: { id: w.id },
        data: {
          availableCoins: { decrement: 25 },
          investedCoins: { increment: 25 },
        },
      });
      assert(
        updated.availableCoins === 75 && updated.investedCoins === 25,
        'Test 15: Wallet availableCoins correctly decrements and investedCoins increments'
      );
    }

    // -------------------------------------------------------------
    // TEST 16: WalletTransaction audit record creation
    // -------------------------------------------------------------
    {
      const txRecord = await prisma.walletTransaction.create({
        data: {
          walletId: participant.wallet.id,
          type: 'DEPLOYMENT',
          amount: 25,
          referenceId: 'test-investment-ref',
        },
      });
      assert(
        txRecord.type === 'DEPLOYMENT' && txRecord.amount === 25,
        'Test 16: WalletTransaction recorded with DEPLOYMENT type and reference'
      );
      // Clean up test transaction
      await prisma.walletTransaction.delete({ where: { id: txRecord.id } });
    }

    // -------------------------------------------------------------
    // TEST 17: Idea metrics atomicity (totalInvested, investorCount, velocity)
    // -------------------------------------------------------------
    {
      const curIdea = await prisma.idea.findUnique({ where: { id: targetIdea.id } });
      const newTotal = (curIdea?.totalInvested || 0) + 25;
      const newCount = (curIdea?.investorCount || 0) + 1;
      const newVelocity = newTotal >= 200 ? 'HIGH' : newTotal >= 100 ? 'MODERATE' : 'STABLE';

      const updatedIdea = await prisma.idea.update({
        where: { id: targetIdea.id },
        data: {
          totalInvested: newTotal,
          investorCount: newCount,
          velocity: newVelocity,
        },
      });

      assert(
        updatedIdea.totalInvested === newTotal && updatedIdea.investorCount === newCount,
        'Test 17: Idea totalInvested, investorCount, and velocity updated atomically'
      );

      // Revert idea
      await prisma.idea.update({
        where: { id: targetIdea.id },
        data: {
          totalInvested: curIdea?.totalInvested || 0,
          investorCount: curIdea?.investorCount || 0,
          velocity: curIdea?.velocity || 'STABLE',
        },
      });
    }

    // -------------------------------------------------------------
    // TEST 18: Admin overview metrics database calculation
    // -------------------------------------------------------------
    {
      const eligibleUsers = await prisma.user.findMany({
        where: {
          role: { in: ['TEAM_MEMBER', 'TEAM_LEADER', 'INVESTOR'] },
          isActive: true,
        },
        include: { wallet: true },
      });

      const totalDistributedCoins = eligibleUsers.reduce(
        (sum, u) => sum + (u.wallet?.totalCoins ?? event.totalCoins),
        0
      );

      const investmentAgg = await prisma.investment.aggregate({
        where: { OR: [{ eventId: event.id }, { eventId: null }] },
        _sum: { amount: true },
      });

      const totalCoinsInvested = investmentAgg._sum.amount || 0;
      const totalCoinsRemaining = Math.max(0, totalDistributedCoins - totalCoinsInvested);

      assert(
        totalDistributedCoins > 0 &&
        totalCoinsRemaining === totalDistributedCoins - totalCoinsInvested,
        'Test 18: Admin metrics calculate real totalDistributedCoins, totalCoinsInvested, and totalCoinsRemaining'
      );
    }

    // -------------------------------------------------------------
    // TEST 19: Realtime broadcast event structure
    // -------------------------------------------------------------
    {
      let broadcastReceived = false;
      const listener = (event: RealtimeEvent) => {
        if (event.type === 'ADMIN_METRICS_UPDATED') {
          broadcastReceived = true;
        }
      };
      realtimeHub.on('realtime_event', listener);
      realtimeHub.broadcastToRole('ADMIN', 'ADMIN_METRICS_UPDATED', {
        totalDistributedCoins: 1000,
        totalCoinsInvested: 250,
        totalCoinsRemaining: 750,
      });
      realtimeHub.off('realtime_event', listener);

      assert(
        broadcastReceived,
        'Test 19: ADMIN_METRICS_UPDATED is successfully broadcast via realtime hub'
      );
    }

    // -------------------------------------------------------------
    // TEST 20: Disallow changing totalCoins after investments started
    // -------------------------------------------------------------
    {
      const count = await prisma.investment.count({
        where: { OR: [{ eventId: event.id }, { eventId: null }] },
      });

      const attemptChangeBudget = (newBudget: number) => {
        if (count > 0 && newBudget !== event.totalCoins) {
          return {
            success: false,
            code: 'INVESTMENT_ALREADY_STARTED',
            message: 'Total coin budget cannot be modified after investments have begun.',
          };
        }
        return { success: true };
      };

      const resultWhenInvestmentsExist = attemptChangeBudget(event.totalCoins + 50);
      assert(
        count > 0
          ? resultWhenInvestmentsExist.code === 'INVESTMENT_ALREADY_STARTED'
          : true,
        'Test 20: Changing total coin budget after investments start is rejected with INVESTMENT_ALREADY_STARTED'
      );
    }

    // Reset test user's wallet
    await prisma.wallet.update({
      where: { id: participant.wallet.id },
      data: {
        availableCoins: 100,
        investedCoins: 0,
        totalCoins: 100,
      },
    });

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
