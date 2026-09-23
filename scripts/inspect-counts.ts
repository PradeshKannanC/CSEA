import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [
    events,
    rooms,
    teams,
    users,
    admins,
    teamLeaders,
    teamMembers,
    investors,
    ideas,
    submissions,
    investments,
    results,
    budgets,
    wallets,
    rosters,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.room.count(),
    prisma.team.count(),
    prisma.user.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'TEAM_LEADER' } }),
    prisma.user.count({ where: { role: 'TEAM_MEMBER' } }),
    prisma.user.count({ where: { role: 'INVESTOR' } }),
    prisma.idea.count(),
    prisma.team.count({ where: { submissionId: { not: '' } } }),
    prisma.investment.count(),
    prisma.result.count(),
    prisma.participantBudget.count(),
    prisma.wallet.count(),
    prisma.teamMember.count(),
  ]);

  console.log('COUNTS_BEGIN');
  console.log(JSON.stringify({
    events,
    rooms,
    teams,
    users,
    admins,
    teamLeaders,
    teamMembers,
    investors,
    ideas,
    submissions,
    investments,
    results,
    budgets,
    wallets,
    rosters,
  }, null, 2));
  console.log('COUNTS_END');
}

main().catch(console.error).finally(() => prisma.$disconnect());

