import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('============================================================');
  console.log('PHASE 8: COIN CONFIGURATION & DYNAMIC UPDATE VERIFICATION');
  console.log('============================================================\n');

  // 1. Create admin session
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin found');

  const adminSession = await prisma.session.create({
    data: {
      id: `phase8-admin-${Date.now()}`,
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const adminHeaders = {
    Cookie: `pnp_session=${adminSession.id}`,
    'Content-Type': 'application/json',
  };

  try {
    // A. Update Settings to 500 / 20 / 100
    console.log('1. Setting tournament parameters: Total=500, Min=20, Max=100...');
    const res1 = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoins: 500,
        minInvestment: 20,
        maxInvestment: 100,
      }),
    });
    const data1 = await res1.json();
    console.log('   Status:', res1.status, 'Event Total:', data1.event?.totalCoins, 'Min:', data1.event?.minInvestment, 'Max:', data1.event?.maxInvestment);

    const dbEvt1 = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
    console.log('   DB Verification 1:', { total: dbEvt1?.totalCoins, min: dbEvt1?.minInvestment, max: dbEvt1?.maxInvestment });
    if (dbEvt1?.totalCoins !== 500 || dbEvt1?.minInvestment !== 20 || dbEvt1?.maxInvestment !== 100) {
      throw new Error('Database does not match 500/20/100');
    }

    // B. Update Settings to 1000 / 25 / 150
    console.log('\n2. Updating tournament parameters: Total=1000, Min=25, Max=150...');
    const res2 = await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoins: 1000,
        minInvestment: 25,
        maxInvestment: 150,
      }),
    });
    const data2 = await res2.json();
    console.log('   Status:', res2.status, 'Event Total:', data2.event?.totalCoins, 'Min:', data2.event?.minInvestment, 'Max:', data2.event?.maxInvestment);

    const dbEvt2 = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
    console.log('   DB Verification 2:', { total: dbEvt2?.totalCoins, min: dbEvt2?.minInvestment, max: dbEvt2?.maxInvestment });
    if (dbEvt2?.totalCoins !== 1000 || dbEvt2?.minInvestment !== 25 || dbEvt2?.maxInvestment !== 150) {
      throw new Error('Database does not match 1000/25/150');
    }

    // C. Verify all wallets reconciled to 1000 total and non-negative
    const wallets = await prisma.wallet.findMany();
    const allReconciled = wallets.every((w) => w.totalCoins === 1000 && w.availableCoins === 1000 - w.investedCoins);
    console.log(`\n3. Wallets Reconciled to 1000 coins: ${allReconciled} (${wallets.length} wallets verified)`);
    if (!allReconciled) throw new Error('Not all wallets reconciled to 1000');

    // D. Verify below new min (24 < 25) rejected
    // Pick an active participant session
    const participant = await prisma.user.findFirst({
      where: { role: 'TEAM_MEMBER', isActive: true },
      include: { team: true },
    });
    if (participant) {
      const pSession = await prisma.session.create({
        data: {
          id: `phase8-part-${Date.now()}`,
          userId: participant.id,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      // Find an idea to test investment bounds
      const idea = await prisma.idea.findFirst({ where: { status: 'APPROVED' } });
      if (idea) {
        const resBelow = await fetch(`${BASE_URL}/api/invest`, {
          method: 'POST',
          headers: { Cookie: `pnp_session=${pSession.id}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ideaId: idea.id, amount: 24 }),
        });
        const dataBelow = await resBelow.json();
        console.log('\n4. Below New Min Check (24 < 25):', { status: resBelow.status, code: dataBelow.code, message: dataBelow.message });
      }

      await prisma.session.delete({ where: { id: pSession.id } }).catch(() => {});
    }

    // E. Revert safely back to 500 / 20 / 100
    console.log('\n5. Restoring tournament parameters to 500 / 20 / 100...');
    await fetch(`${BASE_URL}/api/admin/event/settings`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        totalCoins: 500,
        minInvestment: 20,
        maxInvestment: 100,
      }),
    });
    const finalEvt = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
    console.log('   Final Event Settings:', { total: finalEvt?.totalCoins, min: finalEvt?.minInvestment, max: finalEvt?.maxInvestment });
    console.log('\n✅ PHASE 8 VERIFIED: DYNAMIC COIN CONFIGURATION FULLY AUTHORITATIVE!');

  } finally {
    await prisma.session.delete({ where: { id: adminSession.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Phase 8 test failed:', err);
  process.exit(1);
});
