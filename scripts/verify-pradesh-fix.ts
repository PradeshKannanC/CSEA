import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('===============================================================');
  console.log('  VERIFYING PRADESH KANNAN SINGLE-SOURCE-OF-TRUTH FIX');
  console.log('===============================================================');

  const pradesh = await prisma.user.findFirst({
    where: { email: 'pradesh@student.tce.edu' },
    include: { team: true },
  });

  if (!pradesh) {
    throw new Error('Pradesh user not found');
  }

  console.log('Pradesh found:', pradesh.id, pradesh.name, pradesh.email);

  // 1. Create a session for Pradesh
  const sessionId = 'test-session-pradesh-' + Date.now();
  await prisma.session.create({
    data: {
      id: sessionId,
      userId: pradesh.id,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    },
  });

  const headers = {
    Cookie: `pnp_session=${sessionId}`,
    'Content-Type': 'application/json',
  };

  try {
    // 2. Test /api/auth/me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, { headers });
    const meData = await meRes.json();
    console.log('\n1. /api/auth/me response:');
    console.log('   Authenticated:', meData.authenticated);
    console.log('   Room:', meData.user?.roomId, meData.user?.roomName);
    console.log('   Wallet:', meData.user?.wallet);

    if (meData.user?.wallet?.availableCoins !== 600 || meData.user?.wallet?.investedCoins !== 0) {
      throw new Error(`Expected 600 available / 0 invested, got: ${JSON.stringify(meData.user?.wallet)}`);
    }
    console.log('   ✅ PASS: /api/auth/me shows authoritative 600 available / 0 invested.');

    // 3. Test /api/me/context
    const ctxRes = await fetch(`${BASE_URL}/api/me/context`, { headers });
    const ctxData = await ctxRes.json();
    console.log('\n2. /api/me/context response:');
    console.log('   State:', ctxData.context?.state);
    console.log('   Wallet:', ctxData.context?.wallet);
    console.log('   Budget:', ctxData.context?.budget);

    if (ctxData.context?.wallet?.availableCoins !== 600 || ctxData.context?.wallet?.investedCoins !== 0) {
      throw new Error(`Context wallet mismatch: ${JSON.stringify(ctxData.context?.wallet)}`);
    }
    console.log('   ✅ PASS: /api/me/context reports authoritative 600 available / 0 invested.');

    // 4. Test /api/me/investments (ensuring NO leakage of historical 419 coins from null room)
    const invRes = await fetch(`${BASE_URL}/api/me/investments`, { headers });
    const invData = await invRes.json();
    console.log('\n3. /api/me/investments response:');
    console.log('   Count:', invData.count);
    console.log('   Investments:', invData.investments);

    const hasLeakedHistorical = invData.investments.some((i: any) => !i.roomId || i.roomId !== pradesh.roomId);
    if (hasLeakedHistorical) {
      throw new Error('Historical investments leaked into room-scoped portfolio!');
    }
    console.log('   ✅ PASS: /api/me/investments strictly isolated to Room R3 (0 cross-room / null-room leakages).');

    // 5. Test Investing 150 coins into a target idea in Room R3
    // Find an idea in Room R3 that does NOT belong to Pradesh's team (Team ABC)
    const targetIdea = await prisma.idea.findFirst({
      where: {
        team: {
          roomId: pradesh.roomId!,
          id: { not: pradesh.teamId! },
        },
        status: 'APPROVED',
      },
    });

    if (!targetIdea) {
      throw new Error('No eligible target idea found in Room R3');
    }

    console.log(`\n4. Attempting 150-coin investment into idea ${targetIdea.anonymousId} (${targetIdea.title})...`);
    console.log('   (Previously this threw: "Investment Rejected — You only have 100 coins available.")');

    const investRes = await fetch(`${BASE_URL}/api/invest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ideaId: targetIdea.id,
        amount: 150,
      }),
    });

    const investData = await investRes.json();
    console.log('   Response Status:', investRes.status);
    console.log('   Response Body:', investData);

    if (!investRes.ok || !investData.success) {
      throw new Error(`Investment of 150 coins failed: ${JSON.stringify(investData)}`);
    }

    if (investData.wallet?.availableCoins !== 450 || investData.wallet?.investedCoins !== 150) {
      throw new Error(`Wallet after investment incorrect: ${JSON.stringify(investData.wallet)}`);
    }
    console.log('   ✅ PASS: 150 coins successfully deployed! Available: 450, Invested: 150.');

    // 6. Verify Database ParticipantBudget state
    const freshBudget = await prisma.participantBudget.findUnique({
      where: {
        userId_roomId: {
          userId: pradesh.id,
          roomId: pradesh.roomId!,
        },
      },
    });
    console.log('\n5. DB ParticipantBudget after investment:', freshBudget);
    if (freshBudget?.availableCoins !== 450 || freshBudget?.investedCoins !== 150) {
      throw new Error(`DB budget mismatch: ${JSON.stringify(freshBudget)}`);
    }
    console.log('   ✅ PASS: Database ParticipantBudget exactly 600 allocated / 150 invested / 450 available.');

    // 7. Verify /api/me/investments now reflects exactly this 1 investment of 150 coins
    const postInvRes = await fetch(`${BASE_URL}/api/me/investments`, { headers });
    const postInvData = await postInvRes.json();
    console.log('\n6. /api/me/investments after investment:');
    console.log('   Count:', postInvData.count);
    console.log('   Latest investment amount:', postInvData.investments[0]?.amount);
    if (postInvData.count !== 1 || postInvData.investments[0]?.amount !== 150) {
      throw new Error('Investments list did not show the single 150 coin investment in Room R3');
    }
    console.log('   ✅ PASS: Exactly 1 room investment (150 coins) listed.');

    // 8. Clean up the test investment
    console.log('\n7. Cleaning up test investment to restore Pradesh\'s pristine state...');
    await prisma.investment.delete({ where: { id: investData.investment.id } });
    await prisma.participantBudget.update({
      where: { id: freshBudget.id },
      data: {
        investedCoins: 0,
        availableCoins: 600,
      },
    });
    await prisma.idea.update({
      where: { id: targetIdea.id },
      data: {
        totalInvested: { decrement: 150 },
        investorCount: { decrement: 1 },
      },
    });
    console.log('   ✅ Cleaned up successfully. Budget restored to 600 available.');

    console.log('\n===============================================================');
    console.log('🎉 ALL PRADESH SCENARIO CHECKS PASSED FLAWLESSLY!');
    console.log('===============================================================');
  } finally {
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
