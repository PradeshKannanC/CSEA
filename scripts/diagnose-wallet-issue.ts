import { prisma } from '../lib/prisma';

async function diagnose() {
  console.log('=== ALL INVESTMENTS IN DB ===');
  const invs = await prisma.investment.findMany({
    include: { investor: true, idea: true, room: true },
    orderBy: { createdAt: 'desc' }
  });
  console.log(`Total investments: ${invs.length}`);
  for (const i of invs) {
    console.log(`- ${i.amount} coins | Investor: ${i.investor.email} (${i.investorId}) | Idea: ${i.idea.anonymousId} (${i.ideaId}) | Room: ${i.room?.name} (${i.roomId}) | Time: ${i.createdAt}`);
  }

  console.log('\n=== USERS AND THEIR CURRENT ROOM / WALLET / BUDGET ===');
  const users = await prisma.user.findMany({
    where: { role: { in: ['TEAM_MEMBER', 'TEAM_LEADER', 'INVESTOR'] } },
    include: {
      team: { include: { room: true } },
      wallet: true,
      budgets: { include: { room: true } }
    }
  });

  for (const u of users) {
    const userInvs = invs.filter(i => i.investorId === u.id);
    if (userInvs.length > 0) {
      console.log('--------------------------------------------------');
      console.log(`USER: ${u.name} (${u.email}) [${u.id}] Role: ${u.role}`);
      console.log(`  Team: ${u.team?.name} (${u.teamId})`);
      console.log(`  Authoritative Room (from team): ${u.team?.room?.name} (${u.team?.roomId}) Status: ${u.team?.room?.status}`);
      console.log(`  User.roomId field: ${u.roomId}`);
      console.log(`  User.wallet:`, u.wallet);
      console.log(`  Participant Budgets:`);
      for (const b of u.budgets) {
        console.log(`    * Room: ${b.room?.name} (${b.roomId}) -> Alloc: ${b.allocatedCoins} | Inv: ${b.investedCoins} | Avail: ${b.availableCoins}`);
      }
      console.log(`  Investments (${userInvs.length}):`);
      for (const i of userInvs) {
        console.log(`    - ${i.amount} coins -> ${i.idea.anonymousId} in Room ${i.room?.name} (${i.roomId})`);
      }
    }
  }
}

diagnose().finally(() => prisma.$disconnect());
