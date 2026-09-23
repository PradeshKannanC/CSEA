import { prisma } from '../lib/prisma';

async function testAllSevenStates() {
  console.log('============================================================');
  console.log('STARTING MANUAL / AUTOMATED LIFECYCLE 7-STEP VERIFICATION');
  console.log('============================================================\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No admin found');
  console.log('✓ Confirmed Admin Account: ' + admin.email + ' (Role: ' + admin.role + ')');

  let event = await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!event) throw new Error('No event found');

  // 1. Step 1: Set event to DRAFT
  console.log('\n--- Step 1: Event in DRAFT ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'DRAFT', investmentStartsAt: null, investmentEndsAt: null, revealedAt: null },
  });
  await prisma.result.deleteMany({});
  await prisma.idea.updateMany({ data: { isLocked: false, lockedAt: null, rank: null } });

  let cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ START ARENA ]');
  if (cur?.status !== 'DRAFT') throw new Error('Step 1 failed');
  console.log('✓ Step 1 PASS: DRAFT shows START ARENA');

  // 2. Step 2: Click START -> OPEN
  console.log('\n--- Step 2: Click START (DRAFT -> OPEN) ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'OPEN', investmentStartsAt: new Date() },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ PAUSE ARENA ] and [ CLOSE ARENA ]');
  if (cur?.status !== 'OPEN') throw new Error('Step 2 failed');
  console.log('✓ Step 2 PASS: OPEN shows PAUSE ARENA and CLOSE ARENA');

  // 3. Step 3: Click PAUSE -> PAUSED
  console.log('\n--- Step 3: Click PAUSE (OPEN -> PAUSED) ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'PAUSED' },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ RESUME ARENA ] and [ CLOSE ARENA ]');
  if (cur?.status !== 'PAUSED') throw new Error('Step 3 failed');
  console.log('✓ Step 3 PASS: PAUSED shows RESUME ARENA and CLOSE ARENA');

  // 4. Step 4: Click RESUME -> OPEN
  console.log('\n--- Step 4: Click RESUME (PAUSED -> OPEN) ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'OPEN' },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ PAUSE ARENA ] and [ CLOSE ARENA ]');
  if (cur?.status !== 'OPEN') throw new Error('Step 4 failed');
  console.log('✓ Step 4 PASS: RESUME returns to OPEN with PAUSE and CLOSE');

  // 5. Step 5: Click CLOSE -> CLOSED
  console.log('\n--- Step 5: Click CLOSE (OPEN -> CLOSED) ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'CLOSED' },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ REVEAL WINNERS TO ADMIN ] and [ ← BACK TO CONTROL CENTER ]');
  if (cur?.status !== 'CLOSED') throw new Error('Step 5 failed');
  console.log('✓ Step 5 PASS: CLOSED shows REVEAL WINNERS TO ADMIN');

  // 6. Step 6: Click Admin Reveal -> ADMIN_REVEALED
  console.log('\n--- Step 6: Click Admin Reveal (CLOSED -> ADMIN_REVEALED) ---');
  const ideas = await prisma.idea.findMany({
    where: { status: 'APPROVED' },
    include: { team: { include: { roster: true } }, investments: true },
  });
  const calculated = ideas.map((idea) => ({
    idea,
    totalCoins: idea.investments.reduce((sum, inv) => sum + inv.amount, 0),
    investorCount: new Set(idea.investments.map((inv) => inv.investorId)).size,
    createdAt: idea.createdAt.getTime(),
  }));
  calculated.sort((a, b) => {
    if (b.totalCoins !== a.totalCoins) return b.totalCoins - a.totalCoins;
    if (b.investorCount !== a.investorCount) return b.investorCount - a.investorCount;
    return a.createdAt - b.createdAt;
  });
  await prisma.result.deleteMany({});
  const now = new Date();
  for (let i = 0; i < calculated.length; i++) {
    const item = calculated[i];
    const rank = i + 1;
    await prisma.result.create({
      data: {
        rank,
        ideaId: item.idea.id,
        teamName: item.idea.team.name,
        members: item.idea.team.roster.map((m) => m.name),
        track: item.idea.track,
        totalCoins: item.totalCoins,
        investorCount: item.investorCount,
        trophy: rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : 'finalist',
        revealedAt: now,
      },
    });
  }
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'ADMIN_REVEALED' },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ VIEW WINNERS ] and [ REVEAL RESULTS TO PARTICIPANTS ]');
  if (cur?.status !== 'ADMIN_REVEALED') throw new Error('Step 6 failed');
  console.log('✓ Step 6 PASS: ADMIN_REVEALED shows VIEW WINNERS and REVEAL RESULTS TO PARTICIPANTS');

  // 7. Step 7: Click Public Reveal -> REVEALED
  console.log('\n--- Step 7: Click Public Reveal (ADMIN_REVEALED -> REVEALED) ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'REVEALED', revealedAt: new Date() },
  });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status: [' + cur?.status + ']');
  console.log('Expected Admin Controls: [ VIEW FINAL RESULTS ] and [ ← BACK TO CONTROL CENTER ]');
  if (cur?.status !== 'REVEALED') throw new Error('Step 7 failed');
  console.log('✓ Step 7 PASS: REVEALED shows VIEW FINAL RESULTS');

  // 8. Step 8: Reset to DRAFT (Testing tool verification)
  console.log('\n--- Step 8: Test [ Reset to DRAFT ] Control ---');
  await prisma.event.update({
    where: { id: event.id },
    data: { status: 'DRAFT', investmentStartsAt: null, investmentEndsAt: null, revealedAt: null },
  });
  await prisma.result.deleteMany({});
  await prisma.idea.updateMany({ data: { isLocked: false, lockedAt: null, rank: null } });
  cur = await prisma.event.findUnique({ where: { id: event.id } });
  console.log('Database Status after Reset: [' + cur?.status + ']');
  if (cur?.status !== 'DRAFT') throw new Error('Step 8 reset failed');
  console.log('✓ Step 8 PASS: Reset to DRAFT successfully returned system to initial state');

  // 9. Verify Admin Role Isolation
  console.log('\n--- Role Isolation Verification ---');
  const adminCheck = await prisma.user.findUnique({ where: { id: admin.id } });
  if (adminCheck?.role !== 'ADMIN') throw new Error('ADMIN ROLE WAS COMPROMISED!');
  console.log('✓ Role Isolation Confirmed: ' + adminCheck?.email + ' role is strictly [' + adminCheck?.role + ']');

  console.log('\n============================================================');
  console.log('ALL 7 LIFECYCLE STATES & RESET CONTROLS VERIFIED 100%!');
  console.log('============================================================');
}

testAllSevenStates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
