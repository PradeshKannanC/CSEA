import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('============================================================');
  console.log('DIRECT MYSQL PRODUCTION VERIFICATION QUERY');
  console.log('============================================================\n');

  // Direct SQL queries to MySQL
  const [
    eventsRaw,
    roomsRaw,
    teamsRaw,
    adminsRaw,
    teamLeadersRaw,
    teamMembersRaw,
    investorsRaw,
    ideasRaw,
    investmentsRaw,
    resultsRaw,
    budgetsRaw,
  ] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Event`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Room`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Team`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `User` WHERE role = "ADMIN"'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `User` WHERE role = "TEAM_LEADER"'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `User` WHERE role = "TEAM_MEMBER"'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `User` WHERE role = "INVESTOR"'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Idea`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Investment`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `Result`'),
    prisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as count FROM `ParticipantBudget`'),
  ]);

  const toNum = (raw: any[]) => Number(raw[0]?.count ?? raw[0]?.COUNT ?? 0);

  const eventsCount = toNum(eventsRaw);
  const roomsCount = toNum(roomsRaw);
  const teamsCount = toNum(teamsRaw);
  const adminsCount = toNum(adminsRaw);
  const teamLeadersCount = toNum(teamLeadersRaw);
  const teamMembersCount = toNum(teamMembersRaw);
  const investorsCount = toNum(investorsRaw);
  const ideasCount = toNum(ideasRaw);
  // Submissions count: in this platform, Idea submissions are stored in the Idea table.
  // With 0 ideas, submissions count is 0.
  const submissionsCount = ideasCount;
  const investmentsCount = toNum(investmentsRaw);
  const resultsCount = toNum(resultsRaw);
  const participantBudgetsCount = toNum(budgetsRaw);

  console.log('--- DIRECT MYSQL VERIFICATION COUNTS ---');
  console.log(`- Events count: ${eventsCount}`);
  console.log(`- Rooms count: ${roomsCount}`);
  console.log(`- Teams count: ${teamsCount}`);
  console.log(`- Admins count: ${adminsCount}`);
  console.log(`- Team Leaders count: ${teamLeadersCount}`);
  console.log(`- Team Members count: ${teamMembersCount}`);
  console.log(`- Investors count: ${investorsCount}`);
  console.log(`- Ideas count: ${ideasCount}`);
  console.log(`- Submissions count: ${submissionsCount}`);
  console.log(`- Investments count: ${investmentsCount}`);
  console.log(`- Results count: ${resultsCount}`);
  console.log(`- Participant Budgets count: ${participantBudgetsCount}`);

  console.log('\n--- DETAILED LIST OF 3 REMAINING PRODUCTION TEAMS ---');
  const teams = await prisma.team.findMany({
    include: {
      leader: true,
      roster: {
        include: { user: true },
        orderBy: { role: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  for (const t of teams) {
    console.log(`\nTeam: ${t.name} (Code: ${t.teamId}, Submission ID: ${t.submissionId}, Cohort: ${t.cohort})`);
    console.log(`Member count: ${t.roster.length}`);
    console.log(`Leader: ${t.leader ? `${t.leader.name} <${t.leader.email}> [${t.leader.role}]` : 'None'}`);
    console.log(`Roster:`);
    for (const m of t.roster) {
      console.log(`  - ${m.name} <${m.email}> [${m.role}] (Registered User: ${m.user ? 'YES' : 'NO'}, Active: ${m.user?.isActive})`);
    }
  }

  console.log('\n--- ALL USERS IN DATABASE ---');
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      team: { select: { name: true } },
      wallet: { select: { totalCoins: true, availableCoins: true, investedCoins: true } },
    },
    orderBy: { role: 'asc' },
  });
  console.log(`Total users in DB: ${allUsers.length}`);
  for (const u of allUsers) {
    console.log(`- ${u.name} <${u.email}> [${u.role}] | Team: ${u.team?.name || 'N/A'} | Wallet: ${u.wallet ? `${u.wallet.availableCoins}/${u.wallet.totalCoins}` : 'None'}`);
  }

  console.log('\n--- PRODUCTION EVENT IN DATABASE ---');
  const event = await prisma.event.findFirst();
  console.log(event);

  console.log('\n============================================================');
  console.log('VERIFICATION COMPLETE');
  console.log('============================================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
