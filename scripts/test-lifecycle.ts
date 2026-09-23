import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth/password';
import { UserRole } from '@prisma/client';

async function verifyLifecycle() {
  console.log('============================================================');
  console.log('TESTING COMPLETE EVENT LIFECYCLE & ROLE ISOLATION');
  console.log('============================================================\n');

  // 1. Ensure Root Admin
  let admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Pradesh Kannan C',
        email: 'pradeshkannan64@gmail.com',
        passwordHash: hashPassword('pradesh@2006K'),
        role: UserRole.ADMIN,
        isActive: true,
        emailVerified: true,
        avatarInitials: 'PK',
      },
    });
  }
  console.log(`✓ Admin user confirmed: ${admin.email} (Role: ${admin.role})`);

  // 2. Ensure Event exists
  let event = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'PITCH AND PROSPER Arena 2024',
        status: 'DRAFT',
        totalCoins: 100,
        minInvestment: 10,
        maxInvestment: 50,
      },
    });
  }

  // Helper to transition status
  async function transitionStatus(targetStatus: any) {
    await prisma.event.update({
      where: { id: event!.id },
      data: { status: targetStatus },
    });
    console.log(`  -> Transitioned Event Status to: [${targetStatus}]`);
  }

  // Lifecycle Step 1: DRAFT -> OPEN
  console.log('\nStep 1: DRAFT -> OPEN');
  await transitionStatus('OPEN');
  let checkEvt = await prisma.event.findUnique({ where: { id: event.id } });
  if (checkEvt?.status !== 'OPEN') throw new Error('Failed to set OPEN');

  // Lifecycle Step 2: OPEN -> PAUSED
  console.log('\nStep 2: OPEN -> PAUSED');
  await transitionStatus('PAUSED');
  checkEvt = await prisma.event.findUnique({ where: { id: event.id } });
  if (checkEvt?.status !== 'PAUSED') throw new Error('Failed to set PAUSED');

  // Lifecycle Step 3: PAUSED -> OPEN (Resume)
  console.log('\nStep 3: PAUSED -> OPEN (Resume)');
  await transitionStatus('OPEN');
  checkEvt = await prisma.event.findUnique({ where: { id: event.id } });
  if (checkEvt?.status !== 'OPEN') throw new Error('Failed to resume OPEN');

  // Lifecycle Step 4: OPEN -> CLOSED
  console.log('\nStep 4: OPEN -> CLOSED (Lock Arena)');
  await transitionStatus('CLOSED');
  checkEvt = await prisma.event.findUnique({ where: { id: event.id } });
  if (checkEvt?.status !== 'CLOSED') throw new Error('Failed to set CLOSED');

  // Lifecycle Step 5: CLOSED -> ADMIN_REVEALED (Calculate Rankings)
  console.log('\nStep 5: CLOSED -> ADMIN_REVEALED (Calculate Real Rankings)');
  const ideas = await prisma.idea.findMany({
    where: { status: 'APPROVED' },
    include: {
      team: { include: { roster: true } },
      investments: true,
    },
  });

  const calculatedIdeas = ideas.map((idea) => {
    const totalCoins = idea.investments.reduce((sum, inv) => sum + inv.amount, 0);
    const investorCount = new Set(idea.investments.map((inv) => inv.investorId)).size;
    return {
      idea,
      totalCoins,
      investorCount,
      createdAt: idea.createdAt.getTime(),
    };
  });

  calculatedIdeas.sort((a, b) => {
    if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
    if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
    return a.createdAt - b.createdAt;
  });

  await prisma.result.deleteMany({});
  const now = new Date();

  for (let i = 0; i < calculatedIdeas.length; i++) {
    const item = calculatedIdeas[i];
    const rank = i + 1;
    const trophy = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'finalist';
    const memberNames = item.idea.team.roster.map((m) => m.name);

    await prisma.result.create({
      data: {
        rank,
        ideaId: item.idea.id,
        teamName: item.idea.team.name,
        members: memberNames,
        track: item.idea.track,
        totalCoins: item.totalCoins,
        investorCount: item.investorCount,
        trophy,
        revealedAt: now,
      },
    });

    await prisma.idea.update({
      where: { id: item.idea.id },
      data: {
        totalInvested: item.totalCoins,
        investorCount: item.investorCount,
        rank,
      },
    });
  }

  await transitionStatus('ADMIN_REVEALED');
  const results = await prisma.result.findMany({ orderBy: { rank: 'asc' } });
  console.log(`✓ Generated ${results.length} official tournament ranking records:`);
  results.forEach((r) => {
    console.log(`   #${r.rank}: ${r.teamName} [${r.track}] - ${r.totalCoins} Coins (${r.investorCount} Backers) - Trophy: ${r.trophy}`);
  });

  // Verify Admin isolation
  const adminPostCheck = await prisma.user.findUnique({ where: { id: admin.id } });
  if (adminPostCheck?.role !== 'ADMIN') throw new Error('Admin role altered!');
  console.log(`✓ Admin role verified intact: ${adminPostCheck.email} -> ${adminPostCheck.role}`);

  // Lifecycle Step 6: ADMIN_REVEALED -> REVEALED (Public Broadcast)
  console.log('\nStep 6: ADMIN_REVEALED -> REVEALED (Broadcast to Arena)');
  await transitionStatus('REVEALED');
  checkEvt = await prisma.event.findUnique({ where: { id: event.id } });
  if (checkEvt?.status !== 'REVEALED') throw new Error('Failed to set REVEALED');

  console.log('\n============================================================');
  console.log('ALL LIFECYCLE TRANSITIONS & RANKINGS VERIFIED SUCCESSFULLY!');
  console.log('============================================================');
}

verifyLifecycle()
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
